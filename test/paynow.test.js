import test from "node:test";
import { setImmediate } from "node:timers";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { amountToCents, crc16, createPaynowPayload, receiptPayment as checkReceiptPayment, PAYNOW_TEST_HOST } from "../src/lib/paynow.js";
import { issueTestPayment, issueShortTestPayment, resolveTestPayment, handleTestPayment, paymentItemsForOrder } from "../src/paynowTest.js";
import { qrImageOptions, savePaynowImage } from "../src/lib/paynowImage.js";
import { receiptMessage, watchOrderRequest } from "../src/lib/orderReceipt.js";

const receiptPayment = (receipt, now) => checkReceiptPayment(receipt, now, { testMode: true });
const secret = "fixture-test-secret-not-a-real-credential";
const host = `https://${PAYNOW_TEST_HOST}`;
const order = { ok: true, orderNumber: "TEST-123e4567-e89b-42d3-a456-426614174000", amountDueSgd: 11.34 };
const NOW = 1804485600;
const tokenOf = payment => new URL(payment.url).hash.slice(1);

function fields(value) {
  const output = {};
  while (value.length) {
    const length = Number(value.slice(2, 4));
    assert.ok(Number.isInteger(length) && length > 0 && length <= value.length - 4);
    output[value.slice(0, 2)] = value.slice(4, 4 + length);
    value = value.slice(4 + length);
  }
  return output;
}

test("PNG independently decodes the exact PayNow recipient, cents, reference and CRC", async () => {
  const payment = await issueTestPayment(order, secret, NOW);
  const png = PNG.sync.read(Buffer.from(await QRCode.toBuffer(payment.payload, qrImageOptions)));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded.data, payment.payload);
  const tags = fields(decoded.data);
  assert.equal(tags["00"], "01");
  assert.equal(tags["01"], "12");
  assert.deepEqual(fields(tags["26"]), { "00": "SG.PAYNOW", "01": "0", "02": "+6581307971", "03": "0" });
  assert.equal(tags["53"], "702");
  assert.equal(tags["54"], "11.34");
  assert.equal(fields(tags["62"])["01"], payment.reference);
  assert.match(payment.reference, /^T[A-F0-9]{24}$/);
  // Independent table-based CRC, plus the standard CCITT-FALSE check vector.
  const table = Array.from({ length: 256 }, (_, n) => {
    let remainder = n * 256;
    for (let i = 0; i < 8; i++) remainder = remainder & 32768 ? (remainder * 2) ^ 0x1021 : remainder * 2;
    return remainder & 65535;
  });
  let check = 65535;
  for (const char of decoded.data.slice(0, -4)) check = ((check << 8) ^ table[((check >> 8) ^ char.charCodeAt(0)) & 255]) & 65535;
  assert.equal(tags["63"], check.toString(16).toUpperCase().padStart(4, "0"));
  assert.equal(crc16("123456789"), "29B1");
});

test("invalid amounts and references cannot produce QR codes", async () => {
  for (const amount of [0, -1, null, undefined, "11.34", NaN, Infinity, 1.001, 1000000]) {
    assert.equal(amountToCents(amount), null);
    assert.throws(() => createPaynowPayload(amount, "TEST1"));
    assert.equal(await issueTestPayment({ ...order, amountDueSgd: amount }, secret, NOW), null);
  }
  assert.equal(amountToCents(0.29), 29);
  assert.equal(amountToCents(0.01), 1);
  for (const reference of [123, undefined, null, "", "x".repeat(26), "abc\n123", "<script>"]) assert.throws(() => createPaynowPayload(10, reference));
  for (const result of [{ ...order, ok: false }, { ...order, orderNumber: "SG-production" }, { ...order, orderNumber: "" }]) assert.equal(await issueTestPayment(result, secret, NOW), null);
  assert.equal(await issueTestPayment(order, "", NOW), null);
});

test("links resolve without storage, reject tampering, wrong secrets, malformed and expired tokens", async () => {
  const payment = await issueTestPayment(order, secret, NOW);
  const token = tokenOf(payment);
  assert.deepEqual(await resolveTestPayment(token, secret, NOW), payment);
  assert.equal(await resolveTestPayment(token, secret, payment.expiresAt), null);
  assert.equal(await resolveTestPayment(token, secret, NOW - 1), null);
  assert.equal(await resolveTestPayment(token, "another environment", NOW), null);
  for (const invalid of [null, "", "x".repeat(2000), "abc.def", token + "x", token.replace(/^./, token[0] === "a" ? "b" : "a")]) {
    assert.equal(await resolveTestPayment(invalid, secret, NOW), null);
  }
  const [body, signature] = token.split(".");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const wrongPurpose = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("some-other-purpose:" + body))).toString("base64url");
  assert.equal(await resolveTestPayment(`${body}.${wrongPurpose}`, secret, NOW), null);
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  assert.deepEqual(Object.keys(claims).sort(), ["cents", "exp", "iat", "orderNumber", "v"]);
  const changed = Buffer.from(JSON.stringify({ ...claims, cents: 1 })).toString("base64url");
  assert.equal(await resolveTestPayment(`${changed}.${signature}`, secret, NOW), null);
  const replay = await issueTestPayment({ ...order, duplicate: true }, secret, NOW + 100);
  assert.equal(replay.payload, payment.payload);
  assert.equal(replay.reference, payment.reference);
});

test("resolver rejects invalid boundaries and returns only verified payment details", async () => {
  const payment = await issueTestPayment(order, secret);
  const env = { TEST_ORDER_WEBHOOK_SECRET: secret };
  const request = (overrides = {}) => new Request(host + "/api/paynow/resolve", { method: "POST",
    headers: { Origin: host, "Content-Type": "application/json" }, body: JSON.stringify({ token: tokenOf(payment) }), ...overrides });
  const response = await handleTestPayment(request(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).paynow, payment);
  assert.equal((await handleTestPayment(new Request("https://swirlgirl.sg/api/paynow/resolve"), env)).status, 403);
  assert.equal((await handleTestPayment(new Request(host + "/api/paynow/resolve"), env)).status, 405);
  assert.equal((await handleTestPayment(request({ headers: { Origin: "https://evil.example", "Content-Type": "application/json" } }), env)).status, 403);
  assert.equal((await handleTestPayment(request({ headers: { Origin: host, "Content-Type": "text/plain" } }), env)).status, 415);
  assert.equal((await handleTestPayment(request({ body: "x".repeat(20001) }), env)).status, 413);
  assert.equal((await handleTestPayment(request({ body: "{}" }), env)).status, 400);
  assert.equal((await handleTestPayment(request(), {})).status, 503);
});

test("only consistent saved test receipts include a payment link in WhatsApp", async () => {
  const paynow = await issueTestPayment(order, secret);
  let receipt;
  await watchOrderRequest(Promise.resolve({ ...order, paynow }), update => { receipt = { message: "Swirl Girl\nPlease confirm availability and PayNow details.", ...update }; });
  assert.equal(receiptPayment(receipt).url, paynow.url);
  assert.match(receiptMessage(receipt, { testMode: true }), /^Payment QR \(TEST\): https:\/\/test-swirl-girl/);
  assert.doesNotMatch(receiptMessage(receipt), /Payment QR \(TEST\)/);
  const invalid = [
    ...["pending", "delayed", "rejected", "unverified"].map(status => ({ ...receipt, status })),
    { ...receipt, amountDueSgd: 0 }, { ...receipt, amountDueSgd: 12 },
    { ...receipt, orderNumber: "TEST-other" },
    { ...receipt, paynow: { ...paynow, expiresAt: 1 } },
    { ...receipt, paynow: { ...paynow, payload: "bad" } },
    { ...receipt, paynow: { ...paynow, url: paynow.url.replace(host, "https://evil.example") } },
  ];
  for (const candidate of invalid) {
    assert.equal(receiptPayment(candidate), null);
    assert.doesNotMatch(receiptMessage(candidate, { testMode: true }), /Payment QR \(TEST\)/);
  }
});

test("save shares a PNG, treats cancellation as cancellation, and falls back to download", async () => {
  const actions = [];
  const link = { click() { actions.push("click"); }, remove() { actions.push("remove"); } };
  const document = { createElement: () => link, body: { appendChild() { actions.push("append"); } } };
  const data = "data:image/png;base64,aGVsbG8=";
  const browser = { document, navigator: { canShare: () => true, share: async ({ files }) => {
    assert.equal(files[0].type, "image/png");
    assert.equal(files[0].name, "swirl-paynow-TEST1.png");
  } } };
  assert.equal(await savePaynowImage(data, "TEST1", browser), "shared");
  assert.equal(actions.length, 0);
  browser.navigator.share = async () => { throw Object.assign(new Error(), { name: "AbortError" }); };
  assert.equal(await savePaynowImage(data, "TEST1", browser), "cancelled");
  assert.equal(actions.length, 0);
  browser.navigator.share = async () => { throw new Error("Not supported"); };
  assert.equal(await savePaynowImage(data, "TEST1", browser), "downloaded");
  assert.deepEqual(actions, ["append", "click", "remove"]);
  assert.equal(link.download, "swirl-paynow-TEST1.png");
  browser.navigator = {};
  assert.equal(await savePaynowImage(data, "TEST1", browser), "downloaded");
});


test("signed item lists survive a fresh link and reject altered names and quantities", async () => {
  const items = [{ name: "Banana Cake (cake)", quantity: 2 }, { name: "Chocolate chips for Banana Cake", quantity: 2 }];
  const payment = await issueTestPayment(order, secret, NOW, items);
  assert.deepEqual(payment.items, items);
  assert.deepEqual((await resolveTestPayment(tokenOf(payment), secret, NOW)).items, items);
  const [body, signature] = tokenOf(payment).split(".");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  claims.items[0].quantity = 99;
  const changed = Buffer.from(JSON.stringify(claims)).toString("base64url");
  assert.equal(await resolveTestPayment(`${changed}.${signature}`, secret, NOW), null);
  for (const invalid of [[], [{ name: "", quantity: 1 }], [{ name: "x".repeat(81), quantity: 1 }], [{ name: "Cake", quantity: 0 }], [{ name: "Cake", quantity: "1" }], Array(22).fill({ name: "Cake", quantity: 1 })]) {
    assert.equal(await issueTestPayment(order, secret, NOW, invalid), null);
  }
  const largest = Array.from({ length: 21 }, () => ({ name: "蛋".repeat(80), quantity: 100 }));
  const large = await issueTestPayment(order, secret, undefined, largest);
  const response = await handleTestPayment(new Request(host + "/api/paynow/resolve", { method: "POST", headers: { Origin: host, "Content-Type": "application/json" }, body: JSON.stringify({ token: tokenOf(large) }) }), { TEST_ORDER_WEBHOOK_SECRET: secret });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).paynow.items, largest);
  const legacy = await issueTestPayment(order, secret, NOW);
  assert.equal((await resolveTestPayment(tokenOf(legacy), secret, NOW)).items, undefined);
});

test("item list uses accepted quantities and menu labels, includes add-ons and ignores display text", () => {
  const summary = paymentItemsForOrder({ lineItems: [{ productId: "banana-bread", quantity: 2 }, { productId: "retired-bake", quantity: 1 }], bananaChocolateChips: true, items: "Anything for free" }, { products: [{ id: "banana-bread", productName: "Banana Cake", per: "cake" }] });
  assert.deepEqual(summary, [{ name: "Banana Cake (cake)", quantity: 2 }, { name: "retired-bake", quantity: 1 }, { name: "Chocolate chips for Banana Cake", quantity: 2 }]);
});


test("short links await storage, stay compact with a full basket and expire with the signed record", async () => {
  const records = new Map();
  let finishWrite;
  let stored;
  const env = { TEST_ORDER_WEBHOOK_SECRET: secret, MENU_SNAPSHOT: {
    put: async (key, value, options) => {
      stored = { key, value, options };
      await new Promise(resolve => { finishWrite = resolve; });
      records.set(key, value);
    },
    get: async key => records.get(key) ?? null,
  } };
  const items = Array.from({ length: 21 }, () => ({ name: "蛋".repeat(80), quantity: 100 }));
  let finished = false;
  const pending = issueShortTestPayment(order, env, undefined, items).then(payment => { finished = true; return payment; });
  while (!finishWrite) await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false, "Do not publish a link before its record is saved");
  assert.equal(records.size, 0);
  finishWrite();
  const payment = await pending;
  assert.match(payment.url, /\/pay#s\.[A-Za-z0-9_-]{22}$/);
  assert.ok(payment.url.length < 80);
  assert.equal(stored.key, "isolated-test:paynow-link-v1:" + tokenOf(payment).slice(2));
  assert.deepEqual(stored.options, { expiration: payment.expiresAt });
  assert.equal(await resolveTestPayment(stored.value, secret, payment.expiresAt), null);
  const claims = JSON.parse(Buffer.from(stored.value.split(".")[0], "base64url").toString());
  assert.deepEqual(Object.keys(claims).sort(), ["cents", "exp", "iat", "items", "orderNumber", "v"]);
  const receipt = { status: "saved", message: "Swirl Girl test order", ...order, paynow: payment };
  assert.equal(receiptPayment(receipt), payment);
  assert.equal(receiptMessage(receipt, { testMode: true }).split("\n")[0], "Payment QR (TEST): " + payment.url);
  const resolve = (token = tokenOf(payment)) => handleTestPayment(new Request(host + "/api/paynow/resolve", { method: "POST", headers: { Origin: host, "Content-Type": "application/json" }, body: JSON.stringify({ token }) }), env);
  assert.deepEqual((await (await resolve()).json()).paynow, payment);
  records.clear();
  assert.equal((await resolve()).status, 404);
  records.set(stored.key, stored.value);
  assert.equal((await resolve()).status, 200, "A later read recovers without an order write");
  records.set(stored.key, stored.value + "x");
  assert.equal((await resolve()).status, 400);
  const expired = await issueTestPayment(order, secret, Math.floor(Date.now() / 1000) - 8 * 86400);
  records.set(stored.key, tokenOf(expired));
  assert.equal((await resolve()).status, 400);
  const wrongSecret = await issueTestPayment(order, "wrong environment");
  records.set(stored.key, tokenOf(wrongSecret));
  assert.equal((await resolve()).status, 400);
  assert.equal((await resolve("s.bad")).status, 400);
  env.MENU_SNAPSHOT.get = async () => { throw new Error("private storage failure"); };
  const unavailable = await resolve();
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private storage failure/);
});

test("short link writes fail safely and invalid orders never write link records", async () => {
  let writes = 0;
  const env = { TEST_ORDER_WEBHOOK_SECRET: secret, MENU_SNAPSHOT: { put: async () => { writes++; throw new Error("storage unavailable"); } } };
  assert.equal(await issueShortTestPayment({ ...order, amountDueSgd: 0 }, env), null);
  assert.equal(writes, 0);
  await assert.rejects(issueShortTestPayment(order, env), /storage unavailable/);
  assert.equal(writes, 1);
  assert.equal(await issueShortTestPayment(order, { TEST_ORDER_WEBHOOK_SECRET: secret }), null);
});
