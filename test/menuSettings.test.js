import test from "node:test";
import assert from "node:assert/strict";
import { mergeMenuSettings } from "../src/lib/menuSettings.js";

const baseMenu = [
  { id: "cinnamon-rolls", name: "Cinnamon Rolls", priceSgd: 35 },
  { id: "banana-bread", name: "Banana Bread", priceSgd: 25 },
];

test("mergeMenuSettings overlays price, availability, and max quantity", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      {
        id: "banana-bread",
        priceSgd: "30",
        available: "No",
        maxQuantity: "2",
      },
    ],
  });

  assert.equal(menu[0].priceSgd, 35);
  assert.equal(menu[0].available, true);
  assert.deepEqual(menu[0].quantityOptions, [1, 2, 3]);
  assert.equal(menu[1].priceSgd, 30);
  assert.equal(menu[1].available, false);
  assert.deepEqual(menu[1].quantityOptions, [1, 2]);
});

test("mergeMenuSettings ignores unknown product ids and invalid values", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      { id: "unknown", priceSgd: "99", available: "No", maxQuantity: "1" },
      { id: "cinnamon-rolls", priceSgd: "-1", available: "maybe", maxQuantity: "0" },
    ],
  });

  assert.equal(menu[0].priceSgd, 35);
  assert.equal(menu[0].available, true);
  assert.deepEqual(menu[0].quantityOptions, [1, 2, 3]);
  assert.equal(menu[1].priceSgd, 25);
});
