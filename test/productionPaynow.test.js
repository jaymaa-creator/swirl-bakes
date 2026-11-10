import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { productionPayments, testPayments } from "../src/paynowPayments.js";
import { receiptPayment } from "../src/lib/paynow.js";
import { receiptMessage } from "../src/lib/orderReceipt.js";
import { qrImageOptions } from "../src/lib/paynowImage.js";
import worker from "../src/worker.js";

const secret = "fixture-only-identical-secret-for-isolation-test";
const result = { ok: true, orderNumber: "SG-0123", amountDueSgd: 25.50 };
const items = [{ name: "Cinnamon Swirls (box of 3)", quantity: 1 }, { name: "Sourdough (loaf)", quantity: 1 }];
const tokenOf = p => new URL(p.url).hash.slice(1);
const request = (token, origin = "https://swirlgirl.sg", overrides = {}) => new Request(origin + "/api/paynow/resolve", {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ token }), ...overrides,
});

test("production and test signatures, order references, storage and receipt URLs cannot cross environments", async () => {
  const records = new Map();
  const env = { ORDER_WEBHOOK_SECRET: secret, TEST_ORDER_WEBHOOK_SECRET: secret,
    MENU_SNAPSHOT: { put: async (k, v) => records.set(k, v), get: async k => records.get(k) } };
  const prod = await productionPayments.issueShort(result, env, undefined, items);
  const isolated = await testPayments.issueShort({ ...result, orderNumber: "TEST-0123" }, env, undefined, items);
  const prodToken = records.get("production:paynow-link-v1:" + tokenOf(prod).slice(2));
  const testToken = records.get("isolated-test:paynow-link-v1:" + tokenOf(isolated).slice(2));
  assert.equal(await testPayments.resolve(prodToken, secret), null);
  assert.equal(await productionPayments.resolve(testToken, secret), null);
  assert.equal(await productionPayments.issue({ ...result, orderNumber: "TEST-0123" }, secret), null);
  assert.equal(await testPayments.issue(result, secret), null);
  assert.equal((await productionPayments.handle(request(tokenOf(isolated)), env)).status, 404);
  // Even if an operator copies a signed test token into a production KV record, fail closed.
  records.set("production:paynow-link-v1:" + tokenOf(prod).slice(2), testToken);
  assert.equal((await productionPayments.handle(request(tokenOf(prod)), env)).status, 400);
  records.set("production:paynow-link-v1:" + tokenOf(prod).slice(2), prodToken);
  const receipt = { ...result, status: "saved", paynow: prod, message: "Swirl Girl reservation\nEstimated total: S$25.50\nPlease confirm availability and PayNow details." };
  assert.equal(receiptPayment(receipt), prod);
  assert.equal(receiptPayment(receipt, undefined, { testMode: true }), null);
  assert.equal(receiptPayment({ ...receipt, paynow: { ...prod, url: isolated.url } }), null);
  assert.equal(receiptMessage(receipt).split("\n")[0], "Payment QR: " + prod.url);
  assert.doesNotMatch(receiptMessage(receipt), /TEST|Estimated total|confirm availability/);
  assert.match(receiptMessage(receipt), /Confirmed amount due: S\$25.50/);
  for (const status of ["pending", "delayed", "rejected", "unverified"]) {
    assert.equal(receiptPayment({ ...receipt, status }), null);
    assert.doesNotMatch(receiptMessage({ ...receipt, status }), /Payment QR:/);
  }
  assert.equal(await productionPayments.resolve(prodToken, "wrong-key"), null);
  assert.equal(await productionPayments.resolve(prodToken, secret, prod.expiresAt), null);
  assert.equal(await productionPayments.resolve(prodToken + "x", secret), null);
  assert.equal(await productionPayments.issue({ ...result, amountDueSgd: 0 }, secret), null);
  const claims = JSON.parse(Buffer.from(prodToken.split(".")[0], "base64url").toString());
  assert.deepEqual(Object.keys(claims).sort(), ["cents", "exp", "iat", "items", "orderNumber", "v"]);
});

test("production resolver validates HTTPS, exact same origin, method and bounded JSON without backend calls", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Payment resolution must not call Sheets"));
  const paynow = await productionPayments.issue(result, secret, undefined, items);
  const token = tokenOf(paynow);
  const env = { ORDER_WEBHOOK_SECRET: secret, ASSETS: { fetch: async () => new Response("app") } };
  for (const origin of ["https://swirlgirl.sg", "https://www.swirlgirl.sg"]) {
    const response = await worker.fetch(request(token, origin), env, {});
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).paynow, paynow);
    for (const path of ["/pay", "/pay/"]) {
      const page = await worker.fetch(new Request(origin + path), env, {});
      assert.equal(page.status, 200);
      assert.equal(page.headers.get("Referrer-Policy"), "no-referrer");
      assert.equal(page.headers.get("Cache-Control"), "no-store");
      assert.equal(page.headers.get("X-Robots-Tag"), "noindex, nofollow");
    }
  }
  for (const host of ["http://swirlgirl.sg", "https://swirlgirl.sg.evil.example", "https://swirl-girl.jaemcd95.workers.dev", "https://test-swirl-girl.jaemcd95.workers.dev"]) {
    assert.equal((await worker.fetch(request(token, host), env, {})).status, 403);
  }
  const check = req => worker.fetch(req, env, {});
  assert.equal((await check(request(token, undefined, { headers: { Origin: "https://www.swirlgirl.sg", "Content-Type": "application/json" } }))).status, 403);
  assert.equal((await check(new Request("https://swirlgirl.sg/api/paynow/resolve"))).status, 405);
  assert.equal((await check(request(token, undefined, { headers: { Origin: "https://swirlgirl.sg", "Content-Type": "text/plain" } }))).status, 415);
  assert.equal((await check(request(token, undefined, { body: "x".repeat(20001) }))).status, 413);
  assert.equal((await check(request(token, undefined, { body: "{" }))).status, 400);
  assert.equal((await productionPayments.handle(request(token), {})).status, 503);
});

test("production PNG independently decodes the recipient, exact amount and stable payment reference", async () => {
  const payment = await productionPayments.issue(result, secret, undefined, items);
  const png = PNG.sync.read(Buffer.from(await QRCode.toBuffer(payment.payload, qrImageOptions)));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded.data, payment.payload);
  assert.ok(decoded.data.includes("0211+6581307971"));
  assert.ok(decoded.data.includes("5303702540525.50"));
  assert.ok(decoded.data.includes("0125" + payment.reference));
  assert.match(payment.reference, /^P[A-F0-9]{24}$/);
  const replay = await productionPayments.issue({ ...result, duplicate: true }, secret);
  assert.equal(replay.payload, payment.payload);
});
