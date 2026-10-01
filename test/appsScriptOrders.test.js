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
      DataValidationCriteria: { CHECKBOX: "CHECKBOX" },
      CopyPasteType: { PASTE_FORMAT: "PASTE_FORMAT", PASTE_DATA_VALIDATION: "PASTE_DATA_VALIDATION" },
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
    reconcilePaidReferralOrders: () => events.push("reconcile"),
    reconcileReferralLedgerForSavedOrders: () => events.push("audit"),
    getNextOrderNumber: () => { events.push("sequence"); return "SG-0123"; },
    applyReferralToOrder: () => { events.push("referral"); return {
      customerKey: "customer-key", referralCode: "SGABC123", referredByCustomerKey: "",
      referralDiscountSgd: 0, creditRedeemedSgd: 0, amountDueSgd: 35,
    }; },
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
  assert.deepEqual([...events], ["lock", "ensure", "lookup", "validate", "audit", "reconcile", "sequence", "referral", "save", "flush", "audit", "flush", "unlock", "queue"]);
  assert.equal(events.savedRow.requestId, REQUEST_ID);
  assert.equal(events.savedRow.requestFingerprint, FINGERPRINT);
  assert.equal(events.savedRow.paid, false);
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
  assert.deepEqual([...events], ["lock", "ensure", "lookup", "audit", "unlock"]);
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

test("a failed audit append still returns the saved order and an exact replay repairs it", () => {
  const { context, events } = harness();
  let saved = null;
  let failNextAudit = false;
  context.findOrderRequest = () => saved;
  context.appendOrderRow = (_sheet, row) => {
    events.push("save");
    saved = { requestFingerprint: FINGERPRINT, orderNumber: row.orderNumber,
      referral: { referralCode: row.customerReferralCode, amountDueSgd: row.amountDue } };
    failNextAudit = true;
  };
  context.reconcileReferralLedgerForSavedOrders = () => {
    events.push("audit");
    if (failNextAudit) { failNextAudit = false; throw new Error("temporary Sheet failure"); }
  };
  context.reportReferralLedgerSyncFailure = () => events.push("alert");
  const first = post(context);
  assert.equal(first.ok, true);
  assert.equal(first.ledgerSyncDeferred, true);
  const replay = post(context);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.ledgerSyncDeferred, false);
  assert.equal(events.filter((event) => event === "save").length, 1);
  assert.equal(events.filter((event) => event === "alert").length, 1);
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
    delivery: "Delivery - flat S$15 fee",
    pickupTime: "",
    address: "10 Joo Chiat Road #01-01",
    quotedTotalSgd: 50,
    totalSgd: 50,
  }).order, {});
  assert.equal(accepted.ok, true);
  assert.equal(accepted.order.estimatedTotal, "S$50.00");
  assert.equal(context.validateOrderForWrite(requestPayload({
    delivery: "Delivery - flat S$15 fee",
    pickupTime: "",
    address: "10 Joo Chiat Road #01-01",
    quotedTotalSgd: 45,
    totalSgd: 45,
  }).order, {}).errorCode, "PRICE_CHANGED");

  const belowMinimum = validationHarness({ priceSgd: 29 });
  assert.equal(belowMinimum.validateOrderForWrite(requestPayload({
    delivery: "Delivery - flat S$15 fee",
    pickupTime: "",
    address: "10 Joo Chiat Road #01-01",
    quotedTotalSgd: 44,
    totalSgd: 44,
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
  constructor(rows, name = "Sheet") { this.rows = rows.map((row) => [...row]); this.name = name; this.parent = null; this.copyOperations = []; this.checkboxCells = []; }
  getLastColumn() { return Math.max(0, ...this.rows.map((row) => row.length)); }
  getLastRow() { return this.rows.length; }
  getName() { return this.name; }
  getParent() { return this.parent; }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
  getRange(row, column, rowCount = 1, columnCount = 1) {
    const sheet = this;
    return {
      getValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
        Array.from({ length: columnCount }, (_, columnOffset) => this.rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? "")
      ),
      getDisplayValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
        Array.from({ length: columnCount }, (_, columnOffset) => String(this.rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ""))
      ),
      setValue: (value) => {
        while (this.rows.length < row) this.rows.push([]);
        this.rows[row - 1][column - 1] = value;
      },
      setValues: (values) => values.forEach((valuesRow, rowOffset) => {
        while (this.rows.length < row + rowOffset) this.rows.push([]);
        valuesRow.forEach((value, columnOffset) => { this.rows[row - 1 + rowOffset][column - 1 + columnOffset] = value; });
      }),
      copyTo: (_target, type) => sheet.copyOperations.push(type),
      getDataValidation: () => sheet.paidValidation || null,
      insertCheckboxes: () => {
        if (sheet.checkboxError) throw sheet.checkboxError;
        sheet.checkboxCells.push([row, column]);
      },
    };
  }
}

class FakeSpreadsheet {
  constructor(sheets) {
    this.sheets = Object.fromEntries(sheets.map((sheet) => { sheet.parent = this; return [sheet.name, sheet]; }));
  }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) { const sheet = new FakeSheet([], name); sheet.parent = this; this.sheets[name] = sheet; return sheet; }
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

test("new order rows preserve an explicit false Paid checkbox", () => {
  const context = baseContext();
  const sheet = new FakeSheet([["Order number", "Paid?"]]);
  context.appendOrderRow(sheet, { orderNumber: "SG-PAID-GUARD", paid: false });
  assert.equal(sheet.rows[1][1], false);
  assert.deepEqual(sheet.checkboxCells, [[2, 2]]);
});

test("native typed Paid columns cannot block saving a complete unpaid order", () => {
  const context = baseContext();
  const sheet = new FakeSheet([["Order no", "Paid?", "Status", "Request ID"], ["SG-0055", true, "Closed", "earlier"]]);
  sheet.checkboxError = new Error("This operation is not allowed on cells in typed columns.");
  context.appendOrderRow(sheet, { orderNumber: "SG-0057", paid: false, status: "New", requestId: REQUEST_ID });
  assert.deepEqual(sheet.rows[2], ["SG-0057", false, "New", REQUEST_ID]);
  assert.deepEqual(sheet.rows[1], ["SG-0055", true, "Closed", "earlier"]);
  assert.deepEqual(sheet.copyOperations, ["PASTE_FORMAT", "PASTE_DATA_VALIDATION"]);
});

test("existing checkbox validation is preserved without reinserting it", () => {
  const context = baseContext();
  const sheet = new FakeSheet([["Order no", "Paid?"]]);
  sheet.paidValidation = { getCriteriaType: () => "CHECKBOX" };
  sheet.checkboxError = new Error("must not be called");
  context.appendOrderRow(sheet, { orderNumber: "SG-0057", paid: false });
  assert.equal(sheet.rows[1][1], false);
});

test("unrelated checkbox errors are not silently treated as successful saves", () => {
  const context = baseContext();
  const sheet = new FakeSheet([["Order no", "Paid?"]]);
  sheet.checkboxError = new Error("Permission denied");
  assert.throws(() => context.appendOrderRow(sheet, { orderNumber: "SG-0057", paid: false }), /Permission denied/);
  assert.equal(sheet.rows.length, 1);
});

test("order allocation advances beyond manual references and never reuses a higher stored sequence", () => {
  const context = baseContext();
  let stored = "54";
  context.PropertiesService.getScriptProperties = () => ({ getProperty: () => stored, setProperty: (_key, value) => { stored = value; } });
  const sheet = new FakeSheet([["Order no"], ["SG-0055"], ["TEST-9999"], [""], ["SG-0052"]]);
  assert.equal(context.getNextOrderNumber(sheet), "SG-0056");
  assert.equal(context.getNextOrderNumber(sheet), "SG-0057");
  stored = "100";
  assert.equal(context.getNextOrderNumber(sheet), "SG-0101");
  stored = "invalid";
  assert.equal(context.getNextOrderNumber(sheet), "SG-0056");
});

test("new orders fill the first blank Order no row instead of skipping to unrelated data", () => {
  const context = baseContext();
  const sheet = new FakeSheet([
    ["Order no", "Name", "Referral metadata"],
    ["SG-1", "First", ""],
    ["", "", "hidden value keeps worksheet row used"],
    ["SG-LATER", "Existing later row", ""],
  ]);
  context.appendOrderRow(sheet, { orderNumber: "SG-2", name: "Second", paid: false });
  assert.equal(sheet.rows[2][0], "SG-2");
  assert.equal(sheet.rows[3][0], "SG-LATER");
  assert.deepEqual(sheet.copyOperations, ["PASTE_FORMAT", "PASTE_DATA_VALIDATION"]);
});

test("two complete calls with the same request ID append exactly one unpaid row with native typed columns", () => {
  const sheet = new FakeSheet([[
    "Order number", "Created at", "Status", "Name", "WhatsApp", "Saturday batch",
    "Items", "Total", "Fulfilment", "Collection slot", "Delivery address", "Notes", "Paid?",
  ]]);
  sheet.checkboxError = new Error("This operation is not allowed on cells in typed columns.");
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
    reconcilePaidReferralOrders: () => {},
    reconcileReferralLedgerForSavedOrders: () => {},
    getNextOrderNumber: () => { sequenceCalls += 1; return "SG-0100"; },
    applyReferralToOrder: () => ({ customerKey: "customer-key", referralCode: "SGABC123",
      referredByCustomerKey: "", referralDiscountSgd: 0, creditRedeemedSgd: 0, amountDueSgd: 35 }),
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
  assert.equal(sheet.rows[1][12], false);
});

function referralContext() {
  const context = baseContext();
  let uuid = 0;
  context.Utilities = {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    computeDigest: (_algorithm, value) => Array.from({ length: 32 }, (_, index) => (value.charCodeAt(index % value.length) + index) % 256),
    getUuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
  };
  return context;
}

test("qualifying first pickup order records S$5 friend discount and customer code", () => {
  const context = referralContext();
  const orders = new FakeSheet([["Order number", "WhatsApp", "Customer Key"]], "Orders");
  const customers = new FakeSheet([
    ["Customer Key", "Referral Code", "Created At", "Source Order"],
    ["referrer-key", "SGFRIEND", new Date("2026-09-01"), "SG-1"],
  ], "Referral Customers");
  const ledger = new FakeSheet([["Event ID", "Timestamp", "Event Type", "Customer Key", "Referral Code", "Amount SGD", "Source Order", "Redemption Order", "Expires At", "Related Event ID", "Detail"]], "Referral Ledger");
  const spreadsheet = new FakeSpreadsheet([orders, customers, ledger]);
  const result = context.applyReferralToOrder(spreadsheet, orders, {
    phone: "+65 9000 0001", delivery: "Self-collection - agreed pickup point",
    itemsTotalSgd: 35, totalSgd: 35, referralCode: "sgfriend",
  }, "SG-2");
  assert.equal(result.referralDiscountSgd, 5);
  assert.equal(result.amountDueSgd, 30);
  assert.equal(result.referredByCustomerKey, "referrer-key");
  assert.match(result.referralCode, /^SG[A-F0-9]{6}$/);
  assert.equal(ledger.rows.length, 1);
  orders.appendRow(["SG-2", "", result.customerKey, "REFERRAL_MVP_V1", result.referredByCustomerKey,
    result.referralDiscountSgd, "SGFRIEND"]);
  orders.rows[0] = ["Order number", "WhatsApp", "Customer Key", "Referral Program Version",
    "Referred By Customer Key", "Referral Discount", "Entered Referral Code"];
  context.reconcileReferralLedgerForSavedOrders(spreadsheet, orders);
  assert.equal(ledger.rows[1][2], "FRIEND_DISCOUNT");
  assert.equal(ledger.rows[1].at(-1), "'+6590000001");
  context.reconcileReferralLedgerForSavedOrders(spreadsheet, orders);
  assert.equal(ledger.rows.length, 2);
});

test("saved friend order repairs a failed ledger append exactly once", () => {
  const context = referralContext();
  const key = context.referralCustomerKey("+65 9000 0003");
  const orders = new FakeSheet([
    ["Order no", "Customer Key", "Referral Program Version", "Referred By Customer Key", "Referral Discount", "Entered Referral Code"],
    ["SG-RECOVER", key, "REFERRAL_MVP_V1", "referrer-key", 5, "SGFRIEND"],
  ], "Orders");
  const customers = new FakeSheet([
    ["Customer Key", "Referral Code", "Created At", "Source Order", "Phone"],
    [key, "SGNEW001", new Date(), "SG-RECOVER", "'+6590000003"],
  ], "Referral Customers");
  const ledger = new FakeSheet([["Event ID", "Timestamp", "Event Type", "Customer Key", "Referral Code", "Amount SGD",
    "Source Order", "Redemption Order", "Expires At", "Related Event ID", "Detail", "Phone"]], "Referral Ledger");
  const spreadsheet = new FakeSpreadsheet([orders, customers, ledger]);
  const append = ledger.appendRow.bind(ledger);
  ledger.appendRow = () => { throw new Error("temporary Sheet failure"); };
  assert.throws(() => context.reconcileReferralLedgerForSavedOrders(spreadsheet, orders), /temporary Sheet failure/);
  assert.equal(ledger.rows.length, 1);
  ledger.appendRow = append;
  context.reconcileReferralLedgerForSavedOrders(spreadsheet, orders);
  context.reconcileReferralLedgerForSavedOrders(spreadsheet, orders);
  assert.equal(ledger.rows.length, 2);
  assert.equal(ledger.rows[1][6], "SG-RECOVER");
});

test("oldest unexpired credit is redeemed once using FIFO", () => {
  const context = referralContext();
  const key = context.referralCustomerKey("+65 9000 0002");
  const orders = new FakeSheet([["Order number", "WhatsApp", "Customer Key"]], "Orders");
  const customers = new FakeSheet([["Customer Key", "Referral Code", "Created At", "Source Order"], [key, "SGRETURN", new Date(), "SG-1"]], "Referral Customers");
  const future = new Date(Date.now() + 86400000);
  const ledger = new FakeSheet([
    ["Event ID", "Timestamp", "Event Type", "Customer Key", "Referral Code", "Amount SGD", "Source Order", "Redemption Order", "Expires At", "Related Event ID", "Detail"],
    ["credit-old", new Date("2026-08-01"), "CREDIT_EARNED", key, "", 5, "SG-A", "", future, "", ""],
    ["credit-new", new Date("2026-09-01"), "CREDIT_EARNED", key, "", 5, "SG-B", "", future, "", ""],
  ], "Referral Ledger");
  const spreadsheet = new FakeSpreadsheet([orders, customers, ledger]);
  const result = context.applyReferralToOrder(spreadsheet, orders, {
    phone: "+65 9000 0002", delivery: "Self-collection - agreed pickup point",
    itemsTotalSgd: 40, totalSgd: 40, referralCode: "",
  }, "SG-C");
  assert.equal(result.creditRedeemedSgd, 5);
  assert.equal(result.amountDueSgd, 35);
  assert.equal(result.creditSourceEventId, "credit-old");
  assert.equal(ledger.rows.length, 3);
  orders.rows[0] = ["Order number", "WhatsApp", "Customer Key", "Referral Program Version",
    "Credit Redeemed", "Credit Source Event ID"];
  orders.appendRow(["SG-C", "", key, "REFERRAL_MVP_V1", 5, result.creditSourceEventId]);
  context.reconcileReferralLedgerForSavedOrders(spreadsheet, orders);
  assert.equal(ledger.rows.at(-1)[9], "credit-old");
  assert.equal(ledger.rows.at(-1).at(-1), "'+6590000002");
});

test("saved order reserves a credit even when its ledger append is pending", () => {
  const context = referralContext();
  const key = context.referralCustomerKey("+65 9000 0002");
  const orders = new FakeSheet([
    ["Order number", "Credit Source Event ID"],
    ["SG-FIRST", "credit-old"],
  ], "Orders");
  const future = new Date(Date.now() + 86400000);
  const ledger = new FakeSheet([
    ["Event ID", "Timestamp", "Event Type", "Customer Key", "Referral Code", "Amount SGD", "Source Order", "Redemption Order", "Expires At", "Related Event ID", "Detail"],
    ["credit-old", new Date("2026-08-01"), "CREDIT_EARNED", key, "", 5, "SG-A", "", future, "", ""],
    ["credit-new", new Date("2026-09-01"), "CREDIT_EARNED", key, "", 5, "SG-B", "", future, "", ""],
  ], "Referral Ledger");
  const spreadsheet = new FakeSpreadsheet([orders, ledger]);
  assert.equal(context.findOldestReferralCredit(spreadsheet, orders, key, new Date()).eventId, "credit-new");
});

test("paid edit locks the ledger decision and ignores a subsequently unchecked box", () => {
  const events = [];
  const sheet = new FakeSheet([
    ["Order no", "Paid?", "Referral Program Version"],
    ["SG-1", true, "REFERRAL_MVP_V1"],
  ], "Orders");
  new FakeSpreadsheet([sheet]);
  const context = baseContext({ events });
  context.earnReferralCreditForOrder = () => events.push("earn");
  const event = { value: "TRUE", range: {
    getRow: () => 2, getColumn: () => 2, getNumRows: () => 1,
    getNumColumns: () => 1, getSheet: () => sheet,
  } };
  context.processPaidReferralEdit(event);
  assert.deepEqual(events, ["lock", "earn", "unlock"]);

  sheet.rows[1][1] = false;
  context.processPaidReferralEdit(event);
  assert.deepEqual(events, ["lock", "earn", "unlock", "lock", "unlock"]);
});

test("copied historical orders cannot mint referral credits", () => {
  const context = referralContext();
  const orders = new FakeSheet([["Order no", "Referred By Customer Key"], ["SG-OLD", "referrer-key"]], "Orders");
  const ledger = new FakeSheet([["Event ID", "Timestamp", "Event Type", "Customer Key", "Referral Code", "Amount SGD",
    "Source Order", "Redemption Order", "Expires At", "Related Event ID", "Detail", "Phone"]], "Referral Ledger");
  const spreadsheet = new FakeSpreadsheet([orders, ledger]);
  context.earnReferralCreditForOrder(spreadsheet, ["order_no", "referred_by_customer_key"], orders.rows[1]);
  assert.equal(ledger.rows.length, 1);
});
