import test from "node:test";
import assert from "node:assert/strict";
import { calculateAddOnTotalSgd, calculateBakesTotalSgd, calculateLineTotalSgd, clearMerchWithoutBakes, hasSelectedBakes, money } from "../src/lib/pricing.js";

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

const mixedMenu = [
  { id: "banana-bread", priceSgd: 25 },
  { id: "tote-bag", kind: "merch", priceSgd: 10 },
];
test("totes do not count towards bake spend and removing all bakes clears merch", () => {
  const form = { items: { "banana-bread": 1, "tote-bag": 2 }, bananaChocolateChips: true };
  assert.equal(calculateBakesTotalSgd(form, mixedMenu), 27);
  assert.equal(hasSelectedBakes(mixedMenu, form.items), true);
  assert.equal(clearMerchWithoutBakes(form, mixedMenu), form);
  const toteOnly = { items: { "banana-bread": 0, "tote-bag": 2 } };
  assert.equal(hasSelectedBakes(mixedMenu, toteOnly.items), false);
  assert.equal(clearMerchWithoutBakes(toteOnly, mixedMenu).items["tote-bag"], 0);
  assert.equal(toteOnly.items["tote-bag"], 2);
  assert.equal(clearMerchWithoutBakes(form, mixedMenu.map((item) => ({ ...item, available: false }))).items["tote-bag"], 0);
});
