import test from "node:test";
import assert from "node:assert/strict";
import { watchOrderRequest, receiptMessage, REFERENCE_WAIT_MS } from "../src/lib/orderReceipt.js";

test("slow order shows a fallback after eight seconds and accepts a late reference", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve;
  const request = new Promise((done) => { resolve = done; });
  const states = [];
  const watching = watchOrderRequest(request, (state) => states.push(state));
  t.mock.timers.tick(REFERENCE_WAIT_MS - 1);
  assert.equal(states.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(states, [{ status: "delayed" }]);
  resolve({ ok: true, orderNumber: "SG-0123" });
  await watching;
  assert.deepEqual(states.at(-1), { status: "saved", orderNumber: "SG-0123" });
});

test("fast response cancels fallback and rejection never implies an unsaved order", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const states = [];
  await watchOrderRequest(Promise.resolve({ orderNumber: "SG-0124" }), (state) => states.push(state));
  t.mock.timers.tick(REFERENCE_WAIT_MS);
  assert.equal(states.length, 1);
  await watchOrderRequest(Promise.reject(new Error("Network failed")), (state) => states.push(state));
  assert.deepEqual(states.at(-1), { status: "unverified" });
});

test("receipt WhatsApp message includes returned reference without changing receipt details", () => {
  const receipt = { message: "Swirl Girl\nTotal: S$15.50", orderNumber: "SG-0123" };
  assert.equal(receiptMessage(receipt), "Swirl Girl\nOrder reference: SG-0123\nTotal: S$15.50");
  assert.equal(receipt.message, "Swirl Girl\nTotal: S$15.50");
});
