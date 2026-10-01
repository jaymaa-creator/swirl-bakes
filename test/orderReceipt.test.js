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
  assert.deepEqual(states.at(-1), { status: "saved", orderNumber: "SG-0123", referralCode: "",
    referralDiscountSgd: 0, creditRedeemedSgd: 0, amountDueSgd: undefined });
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

test("known stock rejection is distinguished from an uncertain network failure", async () => {
  const states = [];
  const error = new Error("A selected bake is sold out");
  error.code = "ORDER_UNAVAILABLE";
  await watchOrderRequest(Promise.reject(error), (state) => states.push(state));
  assert.deepEqual(states, [{ status: "rejected", errorCode: "ORDER_UNAVAILABLE" }]);
});

test("receipt WhatsApp message includes returned reference without changing receipt details", () => {
  const receipt = { message: "Swirl Girl\nTotal: S$15.50", orderNumber: "SG-0123" };
  assert.equal(receiptMessage(receipt), "Swirl Girl\nOrder reference: SG-0123\nTotal: S$15.50");
  assert.equal(receipt.message, "Swirl Girl\nTotal: S$15.50");
});

test("receipt uses authoritative referral result in WhatsApp text", async () => {
  const states = [];
  await watchOrderRequest(Promise.resolve({ orderNumber: "SG-77", referralCode: "SGABC123",
    referralDiscountSgd: 5, creditRedeemedSgd: 0, amountDueSgd: 30 }), (state) => states.push(state));
  assert.equal(states[0].amountDueSgd, 30);
  const message = receiptMessage({ message: "Swirl Girl\nItems subtotal: S$35.00\nEstimated total: S$35.00",
    orderNumber: "SG-77", referralCode: "SGABC123", amountDueSgd: 30 });
  assert.match(message, /Confirmed amount due: S\$30\.00/);
  assert.doesNotMatch(message, /Estimated total:/);
  assert.match(message, /Items subtotal: S\$35\.00/);
});
