import test from "node:test";
import assert from "node:assert/strict";
import { getCheckoutIssues } from "../src/lib/checkoutGuidance.js";

const valid = {
  form: { name: "Test Customer", phone: "+65 8000 0000", delivery: "Self-collection", address: "", pickupTime: "11am-12pm" },
  menuStatus: "ready", hasSelectedItems: true, hasCurrentPrices: true,
  isBakeWindowOpen: true, isDeliveryEligible: true, deliveryMinimumSgd: 30,
  allergenAcknowledged: true, securityRequired: false, turnstileToken: "", turnstileError: "", canSubmitOrder: true,
};
const issues = (changes = {}, formChanges = {}) => getCheckoutIssues({ ...valid, ...changes, form: { ...valid.form, ...formChanges } });

test("ready checkout has no blockers", () => assert.deepEqual(issues(), []));
test("missing contact details are explained in completion order", () => {
  assert.deepEqual(issues({}, { name: " ", phone: "" }).map(x => x.target), ["order-name", "order-phone"]);
  for (const phone of ["abc", "1234567", "1234567890123456"])
    assert.equal(issues({}, { phone })[0].target, "order-phone");
  for (const phone of ["8000 0000", "+65 8000 0000", "123456789012345"])
    assert.deepEqual(issues({}, { phone }), []);
  assert.equal(issues({}, { name: "x".repeat(81) })[0].target, "order-name");
});
test("menu loading and errors explain why checkout must wait", () => {
  assert.match(issues({ menuStatus: "loading" })[0].message, /loading/);
  assert.match(issues({ menuStatus: "error" })[0].message, /Retry/);
  assert.match(issues({ hasCurrentPrices: false })[0].message, /Prices/);
  assert.match(issues({ isBakeWindowOpen: false })[0].message, /closed/);
  assert.match(issues({ hasSelectedItems: false })[0].message, /Choose at least one/);
});
test("fulfilment guidance differentiates pickup, address and delivery minimum", () => {
  assert.equal(issues({}, { pickupTime: "" })[0].target, "order-pickup");
  assert.equal(issues({}, { delivery: "Delivery", address: " " })[0].target, "order-address");
  assert.match(issues({ isDeliveryEligible: false }, { delivery: "Delivery" })[0].message, /S\$30/);
  assert.deepEqual(issues({}, { delivery: "Delivery", address: "Test address", pickupTime: "" }), []);
});
test("allergens and security remain mandatory with useful guidance", () => {
  assert.equal(issues({ allergenAcknowledged: false })[0].target, "order-allergens");
  assert.equal(issues({ securityRequired: true })[0].target, "order-security");
  assert.deepEqual(issues({ securityRequired: true, turnstileToken: "test-token" }), []);
  assert.match(issues({ securityRequired: true, turnstileToken: "test-token", turnstileError: "Security check could not load." })[0].message, /could not load/);
  assert.equal(issues({ securityRequired: true, turnstileToken: "" })[0].target, "order-security");
});
test("parent eligibility gate cannot be bypassed", () => {
  assert.equal(issues({ canSubmitOrder: false }).length, 1);
});
