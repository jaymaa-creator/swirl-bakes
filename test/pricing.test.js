import test from "node:test";
import assert from "node:assert/strict";
import { calculateAddOnTotalSgd, calculateLineTotalSgd, money } from "../src/lib/pricing.js";

test("money preserves cents, including free totals and unknown prices", () => {
  assert.equal(money(0), "S$0.00");
  assert.equal(money(null), "TBC");
  assert.equal(money(12.4), "S$12.40");
  assert.equal(money(15.5), "S$15.50");
  assert.equal(money(31), "S$31.00");
  assert.equal(money(undefined), "TBC");
});

test("calculateLineTotalSgd supports per item pricing", () => {
  const item = { pricing: { mode: "per_item", unitPriceSgd: 7 } };
  assert.equal(calculateLineTotalSgd(item, 3), 21);
});

test("calculateLineTotalSgd supports per pack floor/ceil/prorate", () => {
  const floorItem = {
    pricing: { mode: "per_pack", packSize: 6, packPriceSgd: 24, partialPackPolicy: "floor" },
  };
  const ceilItem = {
    pricing: { mode: "per_pack", packSize: 6, packPriceSgd: 24, partialPackPolicy: "ceil" },
  };
  const prorateItem = {
    pricing: { mode: "per_pack", packSize: 6, packPriceSgd: 24, partialPackPolicy: "prorate" },
  };

  assert.equal(calculateLineTotalSgd(floorItem, 7), 24);
  assert.equal(calculateLineTotalSgd(ceilItem, 7), 48);
  assert.equal(calculateLineTotalSgd(prorateItem, 7), 28);
});

test("calculateAddOnTotalSgd charges S$2 per selected Banana Cake", () => {
  assert.equal(calculateAddOnTotalSgd({ bananaChocolateChips: true, items: { "banana-bread": 2 } }), 4);
  assert.equal(calculateAddOnTotalSgd({ bananaChocolateChips: false, items: { "banana-bread": 2 } }), 0);
});
