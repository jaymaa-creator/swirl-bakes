import test from "node:test";
import assert from "node:assert/strict";
import { mergeMenuSettings } from "../src/lib/menuSettings.js";

const baseMenu = [
  { id: "cinnamon-rolls", name: "Cinnamon Rolls" },
  { id: "banana-bread", name: "Banana Cake" },
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

  assert.equal(menu[0].priceSgd, null);
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

  assert.equal(menu[0].priceSgd, null);
  assert.equal(menu[0].available, true);
  assert.deepEqual(menu[0].quantityOptions, [1, 2, 3]);
  assert.equal(menu[1].priceSgd, null);
});

test("mergeMenuSettings caps order quantities by remaining batch stock", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      {
        id: "banana-bread",
        priceSgd: "25",
        available: true,
        maxQuantity: "3",
        batchLimit: "6",
        soldQuantity: "4",
        remainingQuantity: "2",
      },
    ],
  });

  assert.equal(menu[1].available, true);
  assert.equal(menu[1].batchLimit, 6);
  assert.equal(menu[1].soldQuantity, 4);
  assert.equal(menu[1].remainingQuantity, 2);
  assert.deepEqual(menu[1].quantityOptions, [1, 2]);
});

test("mergeMenuSettings marks a product unavailable when no batch stock remains", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      {
        id: "banana-bread",
        available: true,
        maxQuantity: "3",
        batchLimit: "6",
        soldQuantity: "6",
        remainingQuantity: "0",
      },
    ],
  });

  assert.equal(menu[1].available, false);
  assert.deepEqual(menu[1].quantityOptions, []);
});

test("mergeMenuSettings adds available products from the sheet", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      {
        id: "sourdough",
        priceSgd: "15",
        available: true,
        maxQuantity: "1",
        batchLimit: "2",
        remainingQuantity: "2",
        description: "Homemade sourdough, baked fresh for Saturday.",
      },
    ],
  });

  assert.equal(menu[2].name, "Sourdough");
  assert.equal(menu[2].category, "Staples");
  assert.equal(menu[2].priceSgd, 15);
  assert.equal(menu[2].note, "Homemade sourdough, baked fresh for Saturday.");
  assert.deepEqual(menu[2].quantityOptions, [1]);
  assert.equal(menu[2].image, "/sourdough.webp");
});

test("mergeMenuSettings keeps configured inactive sheet products visible as sold out", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      {
        id: "sourdough",
        priceSgd: "15",
        available: false,
        maxQuantity: "1",
        batchLimit: "2",
        remainingQuantity: "2",
      },
    ],
  });

  assert.equal(menu[2].name, "Sourdough");
  assert.equal(menu[2].available, false);
  assert.equal(menu[2].special, false);
});

test("mergeMenuSettings uses the sheet allergen statement", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [{ id: "banana-bread", priceSgd: 20, allergens: "Contains banana, gluten, dairy and eggs." }],
  });

  assert.equal(menu[1].allergens, "Contains banana, gluten, dairy and eggs.");
});

test("mergeMenuSettings only features available weekly specials", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      { id: "banana-bread", priceSgd: 20, available: true, special: true, maxQuantity: 2 },
      { id: "cinnamon-rolls", priceSgd: 35, available: false, special: true, maxQuantity: 2 },
    ],
  });

  assert.equal(menu[0].available, false);
  assert.equal(menu[0].special, false);
  assert.equal(menu[1].available, true);
  assert.equal(menu[1].special, true);
});
