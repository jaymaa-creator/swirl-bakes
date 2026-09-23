import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

function inventoryHarness() {
  const orders = [
    ["Status", "Saturday batch", "Items"],
    ["Confirmed", new Date("2026-09-19T04:00:00Z"), "Cinnamon Rolls (box of 3) x2, Banana Cake (cake) x1"],
    ["Confirmed", "2026-09-19", "Cinnamon Rolls (box of 3) x3"],
    ["Confirmed", "2026-09-26", "Cinnamon Rolls (box of 3) x4"],
  ];
  const products = [
    ["product_id", "Product Name", "batch_limit", "available", "max_quantity"],
    ["cinnamon-rolls", "Cinnamon Rolls", 6, true, 3],
    ["banana-bread", "Banana Cake", 4, true, 2],
  ];
  const spreadsheet = { getSheetByName: (name) => {
    const rows = name === "Orders" ? orders : products;
    return { getLastRow: () => rows.length, getDataRange: () => ({ getValues: () => rows.map((row) => [...row]) }) };
  } };
  const context = vm.createContext({
    Date, console,
    Session: { getScriptTimeZone: () => "Asia/Singapore" },
    Utilities: { formatDate: (date, timezone, pattern) => {
      if (pattern === "yyyy-MM-dd") return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
      return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date);
    } },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  });
  vm.runInContext(source, context);
  context.getMenuBatchDate = (batch) => new Date(`${batch}T04:00:00Z`);
  const stock = (batch = "2026-09-19", useTest = false) => context.readMenuSettings(true, batch, spreadsheet, [], useTest);
  return { context, orders, stock };
}

test("cancelling restores exact quantities only for the order bake, without double restoration", () => {
  const { orders, stock } = inventoryHarness();
  for (const status of ["Cancelled", " canceled ", "CANCELLED"]) {
    orders[1][0] = "Confirmed";
    assert.equal(stock()[0].remainingQuantity, 1);
    assert.equal(stock()[1].remainingQuantity, 3);
    orders[1][0] = status;
    for (const useTest of [false, true]) {
      for (let refresh = 0; refresh < 2; refresh++) {
        const result = stock("2026-09-19", useTest);
        assert.equal(result[0].soldQuantity, 3);
        assert.equal(result[0].remainingQuantity, 3);
        assert.equal(result[1].soldQuantity, 0);
        assert.equal(result[1].remainingQuantity, 4);
        assert.equal(stock("2026-09-26", useTest)[0].remainingQuantity, 2);
      }
    }
    orders[1][0] = "Confirmed";
    assert.equal(stock()[0].remainingQuantity, 1);
  }
});

test("editing an Orders status records a delta and queues snapshot publication", () => {
  const { context } = inventoryHarness();
  const calls = [];
  const event = { value: "Cancelled", oldValue: "Confirmed", range: { getSheet: () => ({ getName: () => "Orders" }) } };
  context.clearMenuCache = () => calls.push("clear");
  context.recordPendingMenuDelta = (received, sheet) => {
    assert.equal(received, event);
    assert.equal(sheet, "Orders");
    calls.push("delta");
  };
  context.queueMenuSnapshotSync = (sheet) => {
    assert.equal(sheet, "Orders");
    calls.push("queue");
  };
  context.onMenuSheetEdit(event);
  assert.deepEqual(calls, ["clear", "delta", "queue"]);
});
