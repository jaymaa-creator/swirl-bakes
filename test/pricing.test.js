import test from "node:test";
import assert from "node:assert/strict";
import { calculateLineTotalSgd, money } from "../src/lib/pricing.js";

test("money returns TBC for falsy values and rounded SGD for numbers", () => {
  assert.equal(money(0), "TBC");
  assert.equal(money(null), "TBC");
  assert.equal(money(12.4), "S$12");
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
