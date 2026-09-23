import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const FINGERPRINT = "a".repeat(64);
const BATCH = "2026-09-26";

function requestPayload(overrides = {}) {
  return {
    secret: "test-secret",
    requestId: REQUEST_ID,
    requestFingerprint: FINGERPRINT,
    order: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: BATCH,
      delivery: "Self-collection - agreed pickup point",
      pickupTime: "1pm-2pm",
      address: "",
      notes: "No nuts",
      lineItems: [{ productId: "cinnamon-rolls", quantity: 1 }],
      bananaChocolateChips: false,
      quotedTotalSgd: 35,
      totalSgd: 35,
      ...overrides,
    },
  };
}

function baseContext({ events = [], sheet = {} } = {}) {
  const context = vm.createContext({
    console: { log() {}, error() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => "test-secret" }) },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet }),
      flush: () => events.push("flush"),
    },
    LockService: { getScriptLock: () => ({
      waitLock: () => events.push("lock"),
      releaseLock: () => events.push("unlock"),
    }) },
  });
  vm.runInContext(source, context);
  return context;
}

function harness(options = {}) {
  const events = [];
  const sheet = {};
  const context = baseContext({ events, sheet });
  Object.assign(context, {
    jsonResponse: (body) => body,
    ensureOrderRequestColumns: () => events.push("ensure"),
    findOrderRequest: () => { events.push("lookup"); return options.existing || null; },
    validateOrderForWrite: () => {
      events.push("validate");
      return options.validation || { ok: true, order: {
        name: "Jamie", phone: "+65 8123 4567", bakeWindow: BATCH,
        items: "Cinnamon Rolls x1", estimatedTotal: "S$35.00",
        delivery: "Self-collection - agreed pickup point", pickupTime: "1pm-2pm",
        address: "", notes: "No nuts",
      } };
    },
    getNextOrderNumber: () => { events.push("sequence"); return "SG-0123"; },
    appendOrderRow: (_sheet, row) => { events.push("save"); events.savedRow = row; },
    parseCalendarDate: () => new Date("2026-09-26T00:00:00+08:00"),
    whatsAppLink: () => "test",
    queueMenuSnapshotSync: (_sheet, preserve) => { assert.equal(preserve, true); events.push("queue"); },
    publishMenuSnapshot: () => { throw new Error("must not rebuild before responding"); },
  });
  return { context, events };
}

function post(context, payload = requestPayload()) {
  return context.doPost({ postData: { contents: JSON.stringify(payload) } });
}

test("Apps Script validates and saves under one lock before queuing refresh", () => {
  const { context, events } = harness();
  const result = post(context);
  assert.equal(result.orderNumber, "SG-0123");
  assert.deepEqual([...events], ["lock", "ensure", "lookup", "validate", "sequence", "save", "flush", "unlock", "queue"]);
  assert.equal(events.savedRow.requestId, REQUEST_ID);
  assert.equal(events.savedRow.requestFingerprint, FINGERPRINT);
});

test("an exact replay returns the original order without validating or writing again", () => {
  const { context, events } = harness({ existing: {
    requestFingerprint: FINGERPRINT,
    orderNumber: "SG-0007",
  } });
  const result = post(context);
  assert.equal(result.ok, true);
  assert.equal(result.orderNumber, "SG-0007");
  assert.equal(result.duplicate, true);
  assert.deepEqual([...events], ["lock", "ensure", "lookup", "unlock"]);
});

test("reusing a request ID with changed details fails closed", () => {
  const { context, events } = harness({ existing: {
    requestFingerprint: "b".repeat(64),
    orderNumber: "SG-0007",
  } });
  const result = post(context);
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "REQUEST_ID_CONFLICT");
  assert.deepEqual([...events], ["lock", "ensure", "lookup", "unlock"]);
});

test("invalid current inventory never allocates an order number or row", () => {
  const { context, events } = harness({ validation: {
    ok: false,
    errorCode: "ORDER_UNAVAILABLE",
    error: "A selected product is unavailable",
  } });
  assert.equal(post(context).errorCode, "ORDER_UNAVAILABLE");
  assert.deepEqual([...events], ["lock", "ensure", "lookup", "validate", "unlock"]);
});

test("backup scheduling failure does not reject an already saved order", () => {
  const { context } = harness();
  context.queueMenuSnapshotSync = () => { throw new Error("quota"); };
  assert.equal(post(context).ok, true);
});

test("authenticated refresh action does not create another order", () => {
  const { context, events } = harness();
  context.syncMenuSnapshot = () => ({ ok: true });
  assert.equal(context.doPost({ postData: { contents: '{"secret":"test-secret","action":"refreshMenuAfterOrder"}' } }).ok, true);
  assert.deepEqual([...events], []);
  assert.equal(context.doPost({ postData: { contents: '{"secret":"wrong","action":"refreshMenuAfterOrder"}' } }).ok, false);
});

function validationHarness(productOverrides = {}) {
  const context = baseContext();
  Object.assign(context, {
    getRequestedSaturday: () => new Date(`${BATCH}T00:00:00+08:00`),
    readBakeCalendar: () => [{ date: BATCH, open: true }],
    getMenuBatchDate: () => new Date(`${BATCH}T00:00:00+08:00`),
    formatBatchKey: () => BATCH,
    readMenuSettings: () => [{
      id: "cinnamon-rolls",
      productName: "Cinnamon Rolls",
      per: "per box of 6",
      priceSgd: 35,
      available: true,
      maxQuantity: 3,
      remainingQuantity: 3,
      ...productOverrides,
    }],
  });
  return context;
}

test("locked validation recalculates canonical item text and total", () => {
  const context = validationHarness();
  const result = context.validateOrderForWrite(requestPayload({
    items: "Free everything x99",
    estimatedTotal: "S$0.00",
  }).order, {});
  assert.equal(result.ok, true);
  assert.equal(result.order.items, "Cinnamon Rolls (box of 6) x1");
  assert.equal(result.order.estimatedTotal, "S$35.00");
});

test("locked validation rejects sold stock, excessive quantities, and changed prices", () => {
  const soldOut = validationHarness({ remainingQuantity: 0 });
  assert.equal(soldOut.validateOrderForWrite(requestPayload().order, {}).errorCode, "ORDER_UNAVAILABLE");

  const tooMany = validationHarness({ maxQuantity: 1 });
  assert.equal(tooMany.validateOrderForWrite(requestPayload({
    lineItems: [{ productId: "cinnamon-rolls", quantity: 2 }],
    quotedTotalSgd: 70,
    totalSgd: 70,
  }).order, {}).errorCode, "ORDER_UNAVAILABLE");

  const repriced = validationHarness({ priceSgd: 36 });
  assert.equal(repriced.validateOrderForWrite(requestPayload().order, {}).errorCode, "PRICE_CHANGED");
});

test("locked validation rejects closed batches and forged fulfilment details", () => {
  const context = validationHarness();
  context.readBakeCalendar = () => [{ date: BATCH, open: false }];
  assert.equal(context.validateOrderForWrite(requestPayload().order, {}).errorCode, "ORDER_UNAVAILABLE");

  const fulfilment = validationHarness();
  assert.equal(fulfilment.validateOrderForWrite(requestPayload({ pickupTime: "midnight" }).order, {}).errorCode, "INVALID_ORDER");
});

test("locked validation applies delivery threshold and fee", () => {
  const context = validationHarness();
  const accepted = context.validateOrderForWrite(requestPayload({
    delivery: "Delivery - flat S$10 fee",
    pickupTime: "",
    address: "10 Joo Chiat Road #01-01",
    quotedTotalSgd: 45,
    totalSgd: 45,
  }).order, {});
  assert.equal(accepted.ok, true);
  assert.equal(accepted.order.estimatedTotal, "S$45.00");

  const belowMinimum = validationHarness({ priceSgd: 29 });
  assert.equal(belowMinimum.validateOrderForWrite(requestPayload({
    delivery: "Delivery - flat S$10 fee",
    pickupTime: "",
    address: "10 Joo Chiat Road #01-01",
    quotedTotalSgd: 39,
    totalSgd: 39,
  }).order, {}).errorCode, "ORDER_UNAVAILABLE");
});

test("locked validation prices the Banana Cake add-on and accepts cent prices", () => {
  const context = validationHarness();
  context.readMenuSettings = () => [{
    id: "banana-bread", productName: "Banana Cake", per: "per loaf",
    priceSgd: 25.55, available: true, maxQuantity: 3, remainingQuantity: 3,
  }];
  const result = context.validateOrderForWrite(requestPayload({
    lineItems: [{ productId: "banana-bread", quantity: 2 }],
    bananaChocolateChips: true,
    quotedTotalSgd: 55.10,
    totalSgd: 55.10,
  }).order, {});
  assert.equal(result.ok, true);
  assert.match(result.order.items, /Chocolate chips for Banana Cake x2/);
  assert.equal(result.order.estimatedTotal, "S$55.10");
});

class FakeSheet {
  constructor(rows) { this.rows = rows.map((row) => [...row]); }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getLastRow() { return this.rows.length; }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    return {
      getValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
        Array.from({ length: columnCount }, (_, columnOffset) => this.rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? "")
      ),
      setValue: (value) => {
        while (this.rows.length < row) this.rows.push([]);
        this.rows[row - 1][column - 1] = value;
      },
      setValues: (values) => values.forEach((valuesRow, rowOffset) => {
        while (this.rows.length < row + rowOffset) this.rows.push([]);
        valuesRow.forEach((value, columnOffset) => { this.rows[row - 1 + rowOffset][column - 1 + columnOffset] = value; });
      }),
    };
  }
}

test("request identity is stored in Sheet columns and can be found after a restart", () => {
  const context = baseContext();
  const sheet = new FakeSheet([["Order number", "Name"]]);
  context.ensureOrderRequestColumns(sheet);
  context.appendOrderRow(sheet, {
    requestId: REQUEST_ID,
    requestFingerprint: FINGERPRINT,
    orderNumber: "SG-0042",
    name: "Jamie",
  });
  const found = context.findOrderRequest(sheet, REQUEST_ID);
  assert.equal(found.requestFingerprint, FINGERPRINT);
  assert.equal(found.orderNumber, "SG-0042");
});

test("two complete calls with the same request ID append exactly one Sheet row", () => {
  const sheet = new FakeSheet([[
    "Order number", "Created at", "Status", "Name", "WhatsApp", "Saturday batch",
    "Items", "Total", "Fulfilment", "Collection slot", "Delivery address", "Notes",
  ]]);
  const context = baseContext({ sheet });
  let sequenceCalls = 0;
  Object.assign(context, {
    jsonResponse: (body) => body,
    validateOrderForWrite: () => ({ ok: true, order: {
      name: "Jamie", phone: "+65 8123 4567", bakeWindow: BATCH,
      items: "Cinnamon Rolls x1", estimatedTotal: "S$35.00",
      delivery: "Self-collection - agreed pickup point", pickupTime: "1pm-2pm",
      address: "", notes: "",
    } }),
    getNextOrderNumber: () => { sequenceCalls += 1; return "SG-0100"; },
    parseCalendarDate: () => new Date("2026-09-26T00:00:00+08:00"),
    whatsAppLink: () => "test",
    queueMenuSnapshotSync: () => {},
  });

  const first = post(context);
  const replay = post(context);
  assert.equal(first.orderNumber, "SG-0100");
  assert.equal(replay.orderNumber, "SG-0100");
  assert.equal(replay.duplicate, true);
  assert.equal(sequenceCalls, 1);
  assert.equal(sheet.getLastRow(), 2);
});
