import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

function harness() {
  const sheets = {
    Products: [["product_id", "product_name", "price_sgd", "available", "max_quantity", "batch_limit"],
      ["cinnamon-rolls", "Cinnamon Rolls", 35, true, 3, 6]],
    Merch: [["product_id", "product_name", "price_sgd", "available", "test-available", "max_quantity", "stock_limit", "per"],
      ["tote-bag", "Tote bag", 10, true, "", 3, 10, "bag"]],
    Orders: [["Status", "Saturday batch", "Items"],
      ["Confirmed", "2026-10-17", "Cinnamon Rolls x1, Tote bag (bag) x2"],
      ["Confirmed", "2026-10-24", "Tote bag (bag) x1"],
      ["Cancelled", "2026-10-31", "Tote bag (bag) x4"]],
  };
  const spreadsheet = { getSheetByName(name) {
    const rows = sheets[name];
    return rows ? { getLastRow: () => rows.length,
      getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }) } : null;
  } };
  const context = vm.createContext({ Date, console,
    Session: { getScriptTimeZone: () => "Asia/Singapore" },
    Utilities: { formatDate: (date, timezone) => new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    SpreadsheetApp: { openById: () => spreadsheet },
  });
  vm.runInContext(source, context);
  context.getMenuBatchDate = (batch) => new Date(`${batch}T04:00:00Z`);
  const menu = (batch = "2026-10-17", useTest = false) => context.readMenuSettings(true, batch, spreadsheet, [], useTest);
  return { context, sheets, spreadsheet, menu };
}

test("merch stock is shared across dates; cancellations restore once and reinstatement reserves again", () => {
  const { sheets, menu } = harness();
  for (const batch of ["2026-10-17", "2026-10-24", "2026-10-31"]) {
    const tote = menu(batch).find((product) => product.kind === "merch");
    assert.equal(tote.priceSgd, 10);
    assert.equal(tote.soldQuantity, 3);
    assert.equal(tote.remainingQuantity, 7);
  }
  assert.equal(menu()[0].remainingQuantity, 5);
  assert.equal(menu("2026-10-24")[0].remainingQuantity, 6);
  sheets.Orders[1][0] = "Cancelled";
  for (let i = 0; i < 2; i++) assert.equal(menu()[1].remainingQuantity, 9);
  sheets.Orders[1][0] = "Confirmed";
  assert.equal(menu()[1].remainingQuantity, 7);
  sheets.Orders.push(["Confirmed", "2026-11-07", "Tote bag (bag) x7"]);
  assert.equal(menu()[1].remainingQuantity, 0);
});

test("missing Merch tab is optional; test availability and invalid stock fail safely", () => {
  const { sheets, menu } = harness();
  sheets.Merch[1][3] = false;
  sheets.Merch[1][4] = true;
  assert.equal(menu()[1].available, false);
  assert.equal(menu("2026-10-17", true)[1].available, true);
  for (const invalid of ["", -1, 1.5, "oops"]) {
    sheets.Merch[1][6] = invalid;
    assert.equal(menu("2026-10-17", true)[1].available, false);
  }
  delete sheets.Merch;
  assert.equal(menu().length, 1);
});

test("duplicate product IDs are rejected rather than changing order authority", () => {
  const { sheets, menu } = harness();
  sheets.Merch.push([...sheets.Merch[1]]);
  assert.throws(menu, /Duplicate product ID/);
  sheets.Merch.pop();
  sheets.Merch[1][0] = "cinnamon-rolls";
  assert.throws(menu, /Duplicate product ID/);
});

test("Merch setup creates 10 S$10 totes once and preserves an existing tab", () => {
  const { context, spreadsheet } = harness();
  assert.equal(context.setupMerchSettings().created, false);
  spreadsheet.getSheetByName = () => null;
  const rows = [];
  spreadsheet.insertSheet = (name) => {
    assert.equal(name, "Merch");
    return { appendRow: (row) => rows.push(Array.from(row)), setFrozenRows() {}, autoResizeColumns() {} };
  };
  assert.equal(context.setupMerchSettings().created, true);
  assert.equal(rows[1][0], "tote-bag");
  assert.equal(rows[1][2], 10);
  assert.equal(rows[1][6], 10);
});

test("Merch edits queue publication, and totes are excluded from ingredient shopping lists", () => {
  const { context, spreadsheet } = harness();
  const calls = [];
  context.clearMenuCache = () => {};
  context.recordPendingMenuDelta = (_event, sheet) => calls.push(sheet);
  context.queueMenuSnapshotSync = (sheet) => calls.push(sheet);
  context.onMenuSheetEdit({ range: { getSheet: () => ({ getName: () => "Merch" }) } });
  assert.deepEqual(calls, ["Merch", "Merch"]);
  spreadsheet.getSheetByName = (name) => name === "Recipe" ? { getLastRow: () => 2 } : null;
  context.getSoldQuantitiesForBatch = (_sheet, products) => {
    assert.equal(products.length, 0);
    return {};
  };
  context.readRecipeIngredients = () => new Map();
  context.readIngredientLocations = () => new Map();
  const result = context.buildShoppingSnapshot("2026-10-17", spreadsheet, [{ id: "tote-bag", kind: "merch" }]);
  assert.equal(result.items.length, 0);
  assert.equal(result.warnings.length, 0);
});
