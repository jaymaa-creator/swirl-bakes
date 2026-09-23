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

  const cinnamonRolls = menu.find((item) => item.id === "cinnamon-rolls");
  const bananaBread = menu.find((item) => item.id === "banana-bread");

  assert.equal(cinnamonRolls.priceSgd, null);
  assert.equal(cinnamonRolls.available, true);
  assert.deepEqual(cinnamonRolls.quantityOptions, [1, 2, 3]);
  assert.equal(bananaBread, undefined);
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
        productName: "Country Sourdough",
        priceSgd: "15",
        available: true,
        maxQuantity: "1",
        batchLimit: "2",
        remainingQuantity: "2",
        description: "Homemade sourdough, baked fresh for Saturday.",
        per: "Loaf",
      },
    ],
  });

  assert.equal(menu[2].name, "Country Sourdough");
  assert.equal(menu[2].category, "Staples");
  assert.equal(menu[2].priceSgd, 15);
  assert.equal(menu[2].note, "Homemade sourdough, baked fresh for Saturday.");
  assert.equal(menu[2].unitLabel, "per loaf");
  assert.equal(menu[2].quantityLabel, "loaf");
  assert.deepEqual(menu[2].quantityOptions, [1]);
  assert.equal(menu[2].image, "/sourdough.webp");
});

test("mergeMenuSettings uses sheet product names and per labels for existing products", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      {
        id: "cinnamon-rolls",
        productName: "Cinnamon Rolls x 4",
        priceSgd: "20",
        available: true,
        maxQuantity: "2",
        batchLimit: "3",
        remainingQuantity: "3",
        per: "Box of 4",
      },
    ],
  });

  assert.equal(menu[0].name, "Cinnamon Rolls x 4");
  assert.equal(menu[0].unitLabel, "per box of 4");
  assert.equal(menu[0].quantityLabel, "box");
  assert.equal(menu[0].quantityLabelPlural, "boxes");
  assert.equal(menu[0].orderDescription, "box of 4");
});

test("mergeMenuSettings hides configured sheet products when available is false", () => {
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

  assert.equal(menu.find((item) => item.id === "sourdough"), undefined);
});

test("mergeMenuSettings uses the sheet allergen statement", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [{ id: "banana-bread", priceSgd: 20, allergens: "Contains banana, gluten, dairy and eggs." }],
  });

  assert.equal(menu[1].allergens, "Contains banana, gluten, dairy and eggs.");
});

test("mergeMenuSettings treats a blank sheet allergen cell as authoritative", () => {
  const menu = mergeMenuSettings(
    [{ id: "banana-bread", name: "Banana Cake", allergens: "Contains eggs." }],
    { products: [{ id: "banana-bread", priceSgd: 20, allergens: "" }] }
  );

  assert.equal(menu[0].allergens, "");
});

test("mergeMenuSettings only features available weekly specials", () => {
  const menu = mergeMenuSettings(baseMenu, {
    products: [
      { id: "banana-bread", priceSgd: 20, available: true, special: true, maxQuantity: 2 },
      { id: "cinnamon-rolls", priceSgd: 35, available: false, special: true, maxQuantity: 2 },
    ],
  });

  const cinnamonRolls = menu.find((item) => item.id === "cinnamon-rolls");
  const bananaBread = menu.find((item) => item.id === "banana-bread");

  assert.equal(cinnamonRolls, undefined);
  assert.equal(bananaBread.available, true);
  assert.equal(bananaBread.special, true);
});
