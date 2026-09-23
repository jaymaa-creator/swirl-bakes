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
