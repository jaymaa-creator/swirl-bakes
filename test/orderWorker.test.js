import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const BATCH = "2026-09-26";

function order(overrides = {}) {
  return {
    name: "Jamie",
    phone: "+65 8123 4567",
    bakeWindow: BATCH,
    delivery: "Self-collection - agreed pickup point",
    pickupTime: "1pm-2pm",
    address: "",
    notes: "No nuts",
    lineItems: [{ productId: "cinnamon-rolls", quantity: 1 }],
    bananaChocolateChips: false,
    quotedTotalSgd: 35,
    items: "Free everything x99",
    estimatedTotal: "S$0.00",
    ...overrides,
  };
}

function menuSnapshot(productOverrides = {}) {
  return {
    ok: true,
    currentBatch: BATCH,
    snapshots: {
      [BATCH]: {
        ok: true,
        batchKey: BATCH,
        calendar: [{ date: BATCH, open: true }],
        products: [{
          id: "cinnamon-rolls",
          productName: "Cinnamon Rolls",
          per: "per box of 6",
          priceSgd: 35,
          available: true,
          maxQuantity: 3,
          remainingQuantity: 3,
          ...productOverrides,
        }],
      },
    },
  };
}

function environment(overrides = {}) {
  return {
    ORDER_SHEET_WEBHOOK_URL: "https://example.test/exec",
    ORDER_WEBHOOK_SECRET: "test-only",
    MENU_SNAPSHOT: { get: async () => menuSnapshot() },
    ...overrides,
  };
}

function orderRequest(payload = { requestId: REQUEST_ID, order: order() }, headers = {}) {
  return new Request("https://swirlgirl.sg/api/orders", {
    method: "POST",
    headers: { Origin: "https://swirlgirl.sg", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

test("order boundary ignores display text and sends recalculated canonical values", async (t) => {
  const calls = [];
  let finishRefresh;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    if (payload.action === "refreshMenuAfterOrder") {
      return new Promise((resolve) => { finishRefresh = resolve; });
    }
    return Response.json({ ok: true, orderNumber: "SG-0123", menuRefreshDeferred: true });
  });
  const background = [];
  const response = await worker.fetch(orderRequest(), environment(), {
    waitUntil: (promise) => background.push(promise),
  });
  assert.deepEqual(await response.json(), { ok: true, orderNumber: "SG-0123", duplicate: false });
  assert.equal(calls[0].requestId, REQUEST_ID);
  assert.match(calls[0].requestFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(calls[0].order.items, "Cinnamon Rolls (box of 6) x1");
  assert.equal(calls[0].order.estimatedTotal, "S$35.00");
  assert.equal(calls[0].order.totalSgd, 35);
  assert.equal(calls.length, 2);
  assert.equal(background.length, 1);
  finishRefresh(Response.json({ ok: true }));
  await Promise.all(background);
});

test("delivery adds S$15 to the server-calculated food subtotal", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const { order: saved } = JSON.parse(options.body);
    assert.equal(saved.deliveryFeeSgd, 15);
    assert.equal(saved.totalSgd, 50);
    assert.equal(saved.estimatedTotal, "S$50.00");
    return Response.json({ ok: true, orderNumber: "SG-DELIVERY" });
  });
  const response = await worker.fetch(orderRequest({
    requestId: REQUEST_ID,
    order: order({ delivery: "Delivery - flat S$15 fee", pickupTime: "", address: "10 Test Road", quotedTotalSgd: 50 }),
  }), environment(), { waitUntil() {} });
  assert.equal(response.status, 200);
});

test("test host cannot create orders", async () => {
  const response = await worker.fetch(new Request("https://test-swirl-girl.jaemcd95.workers.dev/api/orders", { method: "POST" }), {}, {});
  assert.equal(response.status, 403);
});

test("order boundary rejects malformed IDs, contacts, duplicate products, and fulfilment", async (t) => {
  t.mock.method(globalThis, "fetch", async () => assert.fail("Invalid input must not reach an upstream service"));
  const cases = [
    { requestId: "not-a-uuid", order: order() },
    { requestId: REQUEST_ID, order: order({ phone: "123" }) },
    { requestId: REQUEST_ID, order: order({ lineItems: [
      { productId: "cinnamon-rolls", quantity: 1 },
      { productId: "cinnamon-rolls", quantity: 2 },
    ] }) },
    { requestId: REQUEST_ID, order: order({ pickupTime: "3pm-4pm" }) },
    { requestId: REQUEST_ID, order: order({ bananaChocolateChips: true }) },
  ];
  for (const payload of cases) {
    const response = await worker.fetch(orderRequest(payload), environment(), { waitUntil() {} });
    assert.equal(response.status, 400);
  }
});

test("order boundary enforces content type and actual body size", async () => {
  const wrongType = orderRequest(undefined, { "Content-Type": "text/plain" });
  assert.equal((await worker.fetch(wrongType, environment(), {})).status, 415);

  const oversized = orderRequest({ requestId: REQUEST_ID, order: order({ notes: "x".repeat(17_000) }) });
  oversized.headers.delete("Content-Length");
  assert.equal((await worker.fetch(oversized, environment(), {})).status, 413);
});

test("current availability and price failures are returned from locked backend validation", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    ok: false,
    errorCode: "PRICE_CHANGED",
    error: "The menu price changed; refresh and review the order",
  }));
  const response = await worker.fetch(orderRequest(), environment({
    MENU_SNAPSHOT: { get: async () => menuSnapshot({ priceSgd: 36 }) },
  }), { waitUntil() {} });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    ok: false,
    errorCode: "PRICE_CHANGED",
    error: "The menu price changed; refresh and review the order",
  });
});

test("Turnstile verification uses the order request ID as its retry key", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("siteverify")) {
      assert.equal(options.body.get("idempotency_key"), REQUEST_ID);
      return Response.json({ success: true, action: "order" });
    }
    return Response.json({ ok: true, orderNumber: "SG-0124" });
  });
  const response = await worker.fetch(orderRequest({
    requestId: REQUEST_ID,
    order: order(),
    turnstileToken: "valid-token",
  }), environment({ TURNSTILE_SECRET_KEY: "turnstile-secret" }), { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
});

test("duplicate result keeps the original reference and skips menu refresh", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ ok: true, orderNumber: "SG-ORIGINAL", duplicate: true });
  });
  const response = await worker.fetch(orderRequest(), environment(), {
    waitUntil: () => assert.fail("A duplicate must not refresh inventory"),
  });
  assert.deepEqual(await response.json(), { ok: true, orderNumber: "SG-ORIGINAL", duplicate: true });
  assert.equal(calls, 1);
});

test("merch must accompany bakes and cannot satisfy the delivery minimum", async (t) => {
  const snapshot = menuSnapshot({ priceSgd: 25 });
  snapshot.snapshots[BATCH].products.push({
    id: "tote-bag", productName: "Tote bag", kind: "merch", priceSgd: 10,
    available: true, maxQuantity: 3, remainingQuantity: 2,
  });
  const env = environment({ MENU_SNAPSHOT: { get: async () => snapshot } });
  let writes = 0;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    writes += 1;
    const saved = JSON.parse(options.body).order;
    // Stale KV failures still reach the locked backend so exact replays can
    // return their original reference. Only a valid snapshot gets canonical totals.
    if (saved.totalSgd === undefined) return Response.json({
      ok: false, errorCode: "ORDER_UNAVAILABLE", error: "The order is no longer available",
    });
    assert.equal(saved.totalSgd, 45);
    assert.match(saved.items, /Tote bag x2/);
    return Response.json({ ok: true, orderNumber: "SG-MERCH" });
  });
  const lines = [{ productId: "cinnamon-rolls", quantity: 1 }, { productId: "tote-bag", quantity: 2 }];
  for (const overrides of [
    { lineItems: [lines[1]], quotedTotalSgd: 20 },
    { lineItems: lines, delivery: "Delivery - flat S$15 fee", pickupTime: "", address: "10 Test Road", quotedTotalSgd: 60 },
    { lineItems: [lines[0], { productId: "tote-bag", quantity: 3 }], quotedTotalSgd: 55 },
    { lineItems: lines, quotedTotalSgd: 35 },
  ]) {
    const response = await worker.fetch(orderRequest({ requestId: REQUEST_ID, order: order(overrides) }), env, { waitUntil() {} });
    assert.equal(response.status, 409);
  }
  assert.equal(writes, 4);
  const response = await worker.fetch(orderRequest({ requestId: REQUEST_ID, order: order({ lineItems: lines, quotedTotalSgd: 45 }) }), env, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal(writes, 5);
});


test("both production hosts accept the same validated basket and international contact", async (t) => {
  const snapshot = menuSnapshot({ priceSgd: 15.5 });
  snapshot.snapshots[BATCH].products.push({ id: "Sourdough", productName: "Sourdough", per: "loaf", priceSgd: 10, available: true, remainingQuantity: 3, maxQuantity: 3 });
  const accepted = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const payload = JSON.parse(options.body);
    accepted.push(payload);
    assert.equal(payload.order.totalSgd, 25.5);
    assert.equal(payload.order.phone, "+33 600 000 000");
    assert.match(payload.order.items, /Sourdough/);
    return Response.json({ ok: true, orderNumber: "SG-HOST-FIX", amountDueSgd: 25.5 });
  });
  const env = environment({ MENU_SNAPSHOT: { get: async () => snapshot } });
  const payload = { requestId: REQUEST_ID, order: order({ phone: "+33 600 000 000", lineItems: [{ productId: "cinnamon-rolls", quantity: 1 }, { productId: "Sourdough", quantity: 1 }], quotedTotalSgd: 25.5 }) };
  for (const hostname of ["swirlgirl.sg", "www.swirlgirl.sg"]) {
    const origin = `https://${hostname}`;
    const response = await worker.fetch(new Request(origin + "/api/orders", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(payload) }), env, { waitUntil() {} });
    assert.equal(response.status, 200, hostname);
    assert.equal((await response.json()).orderNumber, "SG-HOST-FIX");
  }
  assert.equal(accepted.length, 2);
  assert.equal(accepted[0].requestFingerprint, accepted[1].requestFingerprint);
});

test("production host repair still rejects previews, lookalike hosts and cross-origin orders", async (t) => {
  t.mock.method(globalThis, "fetch", async () => assert.fail("Rejected hosts must never reach the backend"));
  for (const hostname of ["swirl-girl.jaemcd95.workers.dev", "preview.swirlgirl.sg", "swirlgirl.sg.example.com", "test-swirl-girl.jaemcd95.workers.dev"]) {
    const origin = `https://${hostname}`;
    assert.equal((await worker.fetch(new Request(origin + "/api/orders", { method: "POST", headers: { Origin: origin } }), environment(), {})).status, 403);
  }
  for (const hostname of ["swirlgirl.sg", "www.swirlgirl.sg"]) {
    for (const origin of ["https://evil.example", hostname.startsWith("www.") ? "https://swirlgirl.sg" : "https://www.swirlgirl.sg"]) {
      assert.equal((await worker.fetch(new Request(`https://${hostname}/api/orders`, { method: "POST", headers: { Origin: origin } }), environment(), {})).status, 403);
    }
  }
});

test("production QR uses saved amount on both hosts, reuses menu and preserves saved orders on failure", async (t) => {
  let saved = { ok: true, orderNumber: "SG-0123", amountDueSgd: 30, referralDiscountSgd: 5 };
  let calls = 0;
  let reads = 0;
  let failStorage = false;
  const records = new Map();
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json(saved); });
  const env = environment({ MENU_SNAPSHOT: {
    get: async key => { if (key === "menu-snapshots-v1") { reads++; return menuSnapshot(); } return records.get(key); },
    put: async (key, value) => { if (failStorage) throw new Error("private failure"); records.set(key, value); },
  } });
  const submit = async (host = "swirlgirl.sg") => {
    const req = orderRequest();
    return worker.fetch(new Request(`https://${host}/api/orders`, { method: "POST", headers: { Origin: `https://${host}`, "Content-Type": "application/json" }, body: await req.text() }), env, { waitUntil() {} });
  };
  let first;
  for (const host of ["swirlgirl.sg", "www.swirlgirl.sg"]) {
    const result = await (await submit(host)).json();
    assert.equal(result.paynow.amountDueSgd, 30);
    assert.deepEqual(result.paynow.items, [{ name: "Cinnamon Rolls (box of 6)", quantity: 1 }]);
    assert.match(result.paynow.url, /^https:\/\/swirlgirl.sg\/pay#s\.[A-Za-z0-9_-]{22}$/);
    assert.ok(result.paynow.url.length < 60);
    assert.match(result.paynow.reference, /^P[A-F0-9]{24}$/);
    assert.equal(result.referralDiscountSgd, 5);
    if (first) assert.equal(result.paynow.payload, first.paynow.payload);
    first = result;
    const token = new URL(result.paynow.url).hash.slice(1);
    const resolved = await worker.fetch(new Request(`https://${host}/api/paynow/resolve`, { method: "POST", headers: { Origin: `https://${host}`, "Content-Type": "application/json" }, body: JSON.stringify({ token }) }), env, {});
    assert.deepEqual((await resolved.json()).paynow, result.paynow);
  }
  assert.equal(calls, 2, "Only the two order writes call Apps Script; resolving links never does");
  assert.equal(reads, 2, "QR enrichment adds no menu read");
  saved = { ...saved, duplicate: true };
  const replay = await (await submit()).json();
  assert.equal(replay.duplicate, true);
  assert.equal(replay.paynow.payload, first.paynow.payload);
  failStorage = true;
  const noLink = await (await submit()).json();
  assert.equal(noLink.ok, true);
  assert.equal(noLink.orderNumber, "SG-0123");
  assert.equal(noLink.paynow, undefined);
  failStorage = false;
  for (const amountDueSgd of [0, -1, 1.001, null, undefined]) {
    saved = { ...saved, amountDueSgd };
    assert.equal((await (await submit()).json()).paynow, undefined);
  }
  saved = { ok: false, errorCode: "ORDER_UNAVAILABLE" };
  const rejected = await submit();
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).paynow, undefined);
  assert.equal(records.size, 3, "Only successful positive saved results write links");
});
