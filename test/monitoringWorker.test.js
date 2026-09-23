import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const BATCH = "2026-09-26";

function menuBundle() {
  return {
    ok: true,
    publishedAt: "2026-09-22T08:00:00.000Z",
    currentBatch: BATCH,
    snapshots: {
      [BATCH]: {
        ok: true,
        batchKey: BATCH,
        calendar: [{ date: BATCH, open: true }],
        products: [{
          id: "cinnamon-rolls", productName: "Cinnamon Rolls", priceSgd: 35,
          available: true, maxQuantity: 3, remainingQuantity: 3,
        }],
      },
    },
  };
}

test("monitor endpoint requires the shared secret and returns only operational metadata", async () => {
  const env = {
    ORDER_WEBHOOK_SECRET: "test-secret",
    MENU_SNAPSHOT: {
      get: async (key) => key === "production-monitor-v1"
        ? { events: { orderRelay: { at: "2026-09-22T08:01:00.000Z", message: "relay failed" } } }
        : menuBundle(),
    },
  };
  const unauthorized = await worker.fetch(new Request("https://swirlgirl.sg/api/monitor", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }), env, {});
  assert.equal(unauthorized.status, 401);

  const response = await worker.fetch(new Request("https://swirlgirl.sg/api/monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: "test-secret" }),
  }), env, {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.currentBatch, BATCH);
  assert.equal(body.menuPublishedAt, "2026-09-22T08:00:00.000Z");
  assert.deepEqual(body.events.orderRelay, { at: "2026-09-22T08:01:00.000Z", message: "relay failed" });
  assert.equal(JSON.stringify(body).includes("test-secret"), false);
});

test("an order relay outage is persisted for the scheduled email monitor", async (t) => {
  let monitorState = null;
  const env = {
    ORDER_SHEET_WEBHOOK_URL: "https://example.test/exec",
    ORDER_WEBHOOK_SECRET: "test-secret",
    MENU_SNAPSHOT: {
      get: async (key) => key === "production-monitor-v1" ? monitorState : menuBundle(),
      put: async (key, value) => {
        assert.equal(key, "production-monitor-v1");
        monitorState = JSON.parse(value);
      },
    },
  };
  t.mock.method(globalThis, "fetch", async () => { throw new Error("upstream unavailable"); });
  const background = [];
  const response = await worker.fetch(new Request("https://swirlgirl.sg/api/orders", {
    method: "POST",
    headers: { Origin: "https://swirlgirl.sg", "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: REQUEST_ID,
      order: {
        name: "Jamie", phone: "+65 8123 4567", bakeWindow: BATCH,
        delivery: "Self-collection - agreed pickup point", pickupTime: "1pm-2pm",
        address: "", notes: "", lineItems: [{ productId: "cinnamon-rolls", quantity: 1 }],
        bananaChocolateChips: false, quotedTotalSgd: 35,
      },
    }),
  }), env, { waitUntil: (promise) => background.push(promise) });
  assert.equal(response.status, 502);
  await Promise.all(background);
  assert.match(monitorState.events.orderRelay.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(monitorState.events.orderRelay.message, "An order could not be relayed to Apps Script");
});
