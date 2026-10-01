const SPREADSHEET_ID = "12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A";
const ORDERS_SHEET_NAME = "Orders";
const MENU_SETTINGS_SHEET_NAME = "Products";
const BAKE_CALENDAR_SHEET_NAME = "Calendar";
const RECIPE_SHEET_NAME = "Recipe";
const COSTS_SHEET_NAME = "Costs";
const SECRET_PROPERTY = "ORDER_WEBHOOK_SECRET";
const MENU_SNAPSHOT_URL_PROPERTY = "MENU_SNAPSHOT_URL";
const MENU_SNAPSHOT_TEST_URL_PROPERTY = "MENU_SNAPSHOT_TEST_URL";
const DEFAULT_MENU_SNAPSHOT_TEST_URL = "https://test-swirl-girl.jaemcd95.workers.dev/api/menu/sync";
const ORDER_SEQUENCE_PROPERTY = "ORDER_SEQUENCE";
const MENU_CACHE_KEY = "live-menu-settings-v1";
const MENU_CACHE_SECONDS = 300;
const MENU_SYNC_DELAY_MS = 60 * 1000;
const MENU_SYNC_TRIGGER_HANDLER = "publishQueuedMenuSnapshot";
const PENDING_MENU_DELTAS_PROPERTY = "PENDING_MENU_DELTAS";
const MAX_PENDING_MENU_DELTAS = 25;
const DELIVERY_MINIMUM_SGD = 30;
const DELIVERY_FEE_SGD = 15;
const BANANA_CHOCOLATE_CHIPS_PRICE_SGD = 2;
const DELIVERY_OPTION = "Delivery - flat S$15 fee";
const COLLECTION_OPTION = "Self-collection - agreed pickup point";
const PICKUP_WINDOWS = ["11am-12pm", "12pm-1pm", "1pm-2pm", "2pm-3pm"];
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONITOR_EMAIL = "jaemcd95@gmail.com";
const PRODUCTION_SITE_URL = "https://swirlgirl.sg";
const PRODUCTION_MONITOR_HANDLER = "runProductionHealthCheck";
const MONITOR_HEALTH_STATE_PROPERTY = "PRODUCTION_MONITOR_HEALTH_STATE";
const MONITOR_EVENT_STATE_PROPERTY = "PRODUCTION_MONITOR_EVENT_STATE";
const MONITOR_IMMEDIATE_STATE_PROPERTY = "PRODUCTION_MONITOR_IMMEDIATE_STATE";
const MONITOR_ALERT_THROTTLE_MS = 60 * 60 * 1000;
const REFERRAL_PROGRAM_VERSION = "REFERRAL_MVP_V1";
const REFERRAL_CUSTOMERS_SHEET_NAME = "Referral Customers";
const REFERRAL_LEDGER_SHEET_NAME = "Referral Ledger";
const REFERRAL_MINIMUM_SGD = 35;
const REFERRAL_CREDIT_SGD = 5;
const REFERRAL_EXPIRY_DAYS = 90;
const REFERRAL_MONTHLY_EARN_CAP = 5;

function doGet(event) {
  try {
    return jsonResponse(
      readMenuPayload(
        false,
        event && event.parameter && event.parameter.batch,
        isTestEnvironment(event && event.parameter && event.parameter.environment)
      )
    );
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Unable to load menu settings" });
  }
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData?.contents || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    if (payload.action === "menuSettings") {
      return jsonResponse(readMenuPayload(false, payload.batch, isTestEnvironment(payload.environment)));
    }
    if (payload.action === "refreshMenuAfterOrder") {
      return jsonResponse(syncMenuSnapshot());
    }

    const order = payload.order || {};
    const requestId = String(payload.requestId || "").trim();
    const requestFingerprint = String(payload.requestFingerprint || "").trim().toLowerCase();
    if (!REQUEST_ID_PATTERN.test(requestId) || !/^[0-9a-f]{64}$/.test(requestFingerprint)) {
      return jsonResponse({ ok: false, errorCode: "INVALID_ORDER", error: "Invalid order request" });
    }
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ORDERS_SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ ok: false, error: `Missing "${ORDERS_SHEET_NAME}" sheet` });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let orderNumber = "";
    let referralResult = null;
    let ledgerSyncDeferred = false;
    try {
      ensureOrderRequestColumns(sheet);
      const existing = findOrderRequest(sheet, requestId);
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          return jsonResponse({
            ok: false,
            errorCode: "REQUEST_ID_CONFLICT",
            error: "Request ID already belongs to different order details",
          });
        }
        try {
          reconcileReferralLedgerForSavedOrders(spreadsheet, sheet);
        } catch (syncError) {
          ledgerSyncDeferred = true;
          reportReferralLedgerSyncFailure(syncError);
        }
        return jsonResponse({ ok: true, orderNumber: existing.orderNumber, duplicate: true,
          ledgerSyncDeferred, ...existing.referral });
      }

      const validation = validateOrderForWrite(order, spreadsheet);
      if (!validation.ok) return jsonResponse(validation);

      reconcileReferralLedgerForSavedOrders(spreadsheet, sheet);
      reconcilePaidReferralOrders(spreadsheet, sheet);
      orderNumber = getNextOrderNumber();
      referralResult = applyReferralToOrder(spreadsheet, sheet, validation.order, orderNumber);
      appendOrderRow(sheet, {
        requestId,
        requestFingerprint,
        orderNumber,
        createdAt: new Date(),
        status: "New",
        paid: false,
        name: safeCell(validation.order.name),
        whatsApp: whatsAppLink(validation.order.phone),
        // Store a real date when the site sends its canonical Saturday key so Sheets
        // keeps the same date formatting as the existing Orders rows.
        saturdayBatch: parseCalendarDate(validation.order.bakeWindow),
        items: safeCell(validation.order.items),
        total: safeCell(`S$${referralResult.amountDueSgd.toFixed(2)}`),
        fulfilment: safeCell(validation.order.delivery),
        collectionSlot: safeCell(validation.order.pickupTime),
        deliveryAddress: safeCell(validation.order.address),
        notes: safeCell(validation.order.notes),
        referralProgramVersion: REFERRAL_PROGRAM_VERSION,
        customerKey: referralResult.customerKey,
        customerReferralCode: referralResult.referralCode,
        enteredReferralCode: validation.order.referralCode,
        referralDiscount: referralResult.referralDiscountSgd,
        creditRedeemed: referralResult.creditRedeemedSgd,
        creditSourceEventId: referralResult.creditSourceEventId,
        amountDue: referralResult.amountDueSgd,
        referredByCustomerKey: referralResult.referredByCustomerKey,
      });

      SpreadsheetApp.flush();
      try {
        reconcileReferralLedgerForSavedOrders(spreadsheet, sheet);
        SpreadsheetApp.flush();
      } catch (syncError) {
        ledgerSyncDeferred = true;
        reportReferralLedgerSyncFailure(syncError);
      }
    } finally {
      lock.releaseLock();
    }

    // The Worker starts an immediate background refresh. Keep a scheduled
    // fallback in case its background execution expires or the connection drops.
    try {
      queueMenuSnapshotSync("Orders", true);
    } catch (syncError) {
      console.error("Order saved; backup menu refresh could not be scheduled", syncError);
      reportImmediateMonitoringFailure("order-refresh-scheduling", "An order was saved but its backup menu refresh could not be scheduled.");
    }
    console.log(`Order saved; returning reference ${orderNumber} without waiting for menu publication.`);
    return jsonResponse({ ok: true, orderNumber, menuRefreshDeferred: true, ledgerSyncDeferred,
      referralCode: referralResult.referralCode,
      referralDiscountSgd: referralResult.referralDiscountSgd,
      creditRedeemedSgd: referralResult.creditRedeemedSgd,
      amountDueSgd: referralResult.amountDueSgd });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Invalid order payload" });
  }
}

function reportReferralLedgerSyncFailure(error) {
  console.error("Saved order referral audit deferred", error);
  try {
    reportImmediateMonitoringFailure("referral-ledger-sync", "A saved order needs referral ledger reconciliation.");
  } catch (monitorError) {
    console.error("Referral ledger alert could not be sent", monitorError);
  }
}

function setupMenuSettings() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(MENU_SETTINGS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(MENU_SETTINGS_SHEET_NAME);
  }

  sheet.clear();
  sheet.appendRow(["product_id", "price_sgd", "available", "test-available", "special", "max_quantity", "batch_limit", "description", "allergens", "image_url"]);
  sheet.appendRow(["cinnamon-rolls", 35, true, "", false, 3, 12, "", "", ""]);
  sheet.appendRow(["banana-bread", 25, true, "", false, 3, 6, "", "", ""]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);

  return { ok: true };
}

function setupBakeCalendar() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(BAKE_CALENDAR_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(BAKE_CALENDAR_SHEET_NAME);
  }

  sheet.clear();
  sheet.appendRow(["date", "open"]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  return { ok: true };
}

function testDoPost() {
  const secret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  const result = doPost({
    postData: {
      contents: JSON.stringify({
        secret,
        requestId: Utilities.getUuid(),
        requestFingerprint: "0".repeat(64),
        order: {
          name: "Apps Script test",
          phone: "+65 0000 0000",
          bakeWindow: "Test batch",
          items: "Test item x1",
          estimatedTotal: "S$0",
          delivery: "Self-collection",
          pickupTime: "Morning",
          address: "",
          notes: "Safe to delete",
          lineItems: [{ productId: "cinnamon-rolls", quantity: 1 }],
          bananaChocolateChips: false,
          quotedTotalSgd: 35,
          totalSgd: 35,
        },
      }),
    },
  });

  console.log(result.getContent());
}

function syncMenuSnapshot() {
  console.log("Starting manual menu snapshot sync");
  const pending = takePendingMenuDeltas();
  logPendingMenuDeltas("Manual sync", pending);
  try {
    const result = publishMenuSnapshot();
    console.log(`Menu snapshot sync completed for ${result.currentBatch || "the current batch"}`);
    return result;
  } catch (error) {
    restorePendingMenuDeltas(pending);
    reportImmediateMonitoringFailure("manual-menu-sync", "Manual production menu publication failed.");
    throw error;
  }
}

function installMenuSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(
      (trigger) =>
        trigger.getHandlerFunction() === "onMenuSheetEdit" ||
        trigger.getHandlerFunction() === MENU_SYNC_TRIGGER_HANDLER
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("onMenuSheetEdit")
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();
}

function onMenuSheetEdit(event) {
  const sheetName = event && event.range && event.range.getSheet().getName();
  if (sheetName === ORDERS_SHEET_NAME) processPaidReferralEdit(event);
  if (
    sheetName !== MENU_SETTINGS_SHEET_NAME &&
    sheetName !== ORDERS_SHEET_NAME &&
    sheetName !== BAKE_CALENDAR_SHEET_NAME &&
    sheetName !== RECIPE_SHEET_NAME &&
    sheetName !== COSTS_SHEET_NAME
  ) {
    return;
  }

  clearMenuCache();
  recordPendingMenuDelta(event, sheetName);
  queueMenuSnapshotSync(sheetName);
}

function recordPendingMenuDelta(event, sheetName) {
  const range = event && event.range;
  if (!range) return;

  const sheet = range.getSheet();
  const row = range.getRow();
  const column = range.getColumn();
  const rowCount = range.getNumRows();
  const columnCount = range.getNumColumns();
  const isSingleCell = rowCount === 1 && columnCount === 1;
  const header = row > 1 ? String(sheet.getRange(1, column).getDisplayValue() || "").trim() : "header";
  const productId = sheetName === MENU_SETTINGS_SHEET_NAME && row > 1
    ? String(sheet.getRange(row, 1).getDisplayValue() || "").trim()
    : "";
  const location = `${sheetName}!${range.getA1Notation()}`;
  let detail = `${location}${header ? ` (${header})` : ""}`;

  if (sheetName === ORDERS_SHEET_NAME) {
    detail += " changed (order values hidden)";
  } else if (isSingleCell) {
    const previousValue = event.oldValue === undefined ? "(blank or unavailable)" : String(event.oldValue);
    const nextValue = event.value === undefined ? String(range.getDisplayValue() || "(blank)") : String(event.value);
    detail += `${productId ? ` [${productId}]` : ""}: ${previousValue} -> ${nextValue}`;
  } else {
    detail += ` changed (${rowCount} rows x ${columnCount} columns)`;
  }

  restorePendingMenuDeltas([{ at: new Date().toISOString(), detail }]);
  console.log(`Menu delta recorded: ${detail}`);
}

function getPendingMenuDeltas() {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(PENDING_MENU_DELTAS_PROPERTY);
    const pending = JSON.parse(value || "[]");
    return Array.isArray(pending) ? pending : [];
  } catch {
    return [];
  }
}

function logPendingMenuDeltas(prefix, pending) {
  if (!pending.length) {
    console.log(`${prefix}: no recorded Sheet deltas.`);
    return;
  }

  console.log(`${prefix}: shipping ${pending.length} Sheet delta(s).`);
  pending.forEach((entry) => console.log(`Shipping delta ${entry.at}: ${entry.detail}`));
}

function takePendingMenuDeltas() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10 * 1000);
  try {
    const pending = getPendingMenuDeltas();
    PropertiesService.getScriptProperties().deleteProperty(PENDING_MENU_DELTAS_PROPERTY);
    return pending;
  } finally {
    lock.releaseLock();
  }
}

function restorePendingMenuDeltas(entries) {
  if (!entries.length) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(10 * 1000);
  try {
    const pending = [...entries, ...getPendingMenuDeltas()].slice(-MAX_PENDING_MENU_DELTAS);
    PropertiesService.getScriptProperties().setProperty(
      PENDING_MENU_DELTAS_PROPERTY,
      JSON.stringify(pending)
    );
  } finally {
    lock.releaseLock();
  }
}

function queueMenuSnapshotSync(sheetName, preservePending = false) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10 * 1000);

  try {
    const queuedTriggers = ScriptApp.getProjectTriggers().filter(
      (trigger) => trigger.getHandlerFunction() === MENU_SYNC_TRIGGER_HANDLER
    );
    if (preservePending && queuedTriggers.length) return;

    // Treat this as a debounce. Replacing the trigger avoids a failed or stale
    // one-time trigger permanently blocking future Sheet edits.
    queuedTriggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

    ScriptApp.newTrigger(MENU_SYNC_TRIGGER_HANDLER)
      .timeBased()
      .after(MENU_SYNC_DELAY_MS)
      .create();
    console.log(
      `Menu snapshot ${queuedTriggers.length ? "rescheduled" : "queued"} from ${sheetName}; publishing about 60 seconds after the latest edit.`
    );
  } finally {
    lock.releaseLock();
  }
}

function publishQueuedMenuSnapshot() {
  console.log("Publishing queued menu snapshot after the 60-second edit window.");
  const pending = takePendingMenuDeltas();
  logPendingMenuDeltas("Queued sync", pending);
  try {
    const result = publishMenuSnapshot();
    console.log(`Queued menu snapshot sync completed for ${result.currentBatch || "the current batch"}.`);
    return result;
  } catch (error) {
    restorePendingMenuDeltas(pending);
    reportImmediateMonitoringFailure("queued-menu-sync", "Automatic production menu publication failed.");
    throw error;
  }
}

function setupProductionMonitoring() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === PRODUCTION_MONITOR_HANDLER)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(PRODUCTION_MONITOR_HANDLER)
    .timeBased()
    .everyMinutes(15)
    .create();

  const result = runProductionHealthCheck();
  sendMonitoringEmail(
    "[Swirl Girl] Production monitoring enabled",
    [
      "Production monitoring is now checking every 15 minutes.",
      `Alert recipient: ${MONITOR_EMAIL}`,
      `Initial result: ${result.ok ? "healthy" : `${result.failures.length} issue(s) detected`}`,
      "No customer names, phone numbers, addresses, or order contents are included in alerts.",
    ]
  );
  return result;
}

function runProductionHealthCheck() {
  let status;
  try {
    status = collectProductionHealthStatus();
  } catch (error) {
    status = { failures: ["The monitoring check itself could not complete."], events: {} };
    console.error(error);
  }

  updateProductionHealthAlert(status.failures);
  notifyNewWorkerEvents(status.events);
  return { ok: status.failures.length === 0, failures: status.failures };
}

function collectProductionHealthStatus() {
  const failures = [];
  const homepageResponse = UrlFetchApp.fetch(`${PRODUCTION_SITE_URL}/`, {
    muteHttpExceptions: true,
    followRedirects: true,
  });
  if (homepageResponse.getResponseCode() < 200 || homepageResponse.getResponseCode() >= 400) {
    failures.push(`Production homepage returned HTTP ${homepageResponse.getResponseCode()}.`);
  }

  const menuResponse = UrlFetchApp.fetch(`${PRODUCTION_SITE_URL}/api/menu`, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: { Accept: "application/json" },
  });
  let liveMenu = null;
  try {
    liveMenu = JSON.parse(menuResponse.getContentText() || "{}");
  } catch {
    failures.push("Production menu returned invalid JSON.");
  }
  if (menuResponse.getResponseCode() !== 200 || liveMenu?.ok !== true || !Array.isArray(liveMenu?.products)) {
    failures.push(`Production menu is unavailable (HTTP ${menuResponse.getResponseCode()}).`);
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const calendar = readBakeCalendar(spreadsheet);
  const expectedBatch = formatBatchKey(getMenuBatchDate("", spreadsheet, calendar));
  const expectedProducts = readMenuSettings(true, expectedBatch, spreadsheet, calendar, false);
  if (liveMenu?.ok === true && Array.isArray(liveMenu.products)) {
    if (liveMenu.batchKey !== expectedBatch) {
      failures.push(`Live batch ${liveMenu.batchKey || "(blank)"} does not match Sheets batch ${expectedBatch}.`);
    }
    if (monitoringMenuSignature(liveMenu.products) !== monitoringMenuSignature(expectedProducts)) {
      failures.push("Live product availability, stock, or pricing does not match Google Sheets.");
    }
    if (JSON.stringify(normalizeMonitoringCalendar(liveMenu.calendar)) !== JSON.stringify(normalizeMonitoringCalendar(calendar))) {
      failures.push("Live bake calendar does not match Google Sheets.");
    }
  }

  expectedProducts.forEach((product) => {
    const batchLimit = finiteMonitoringNumber(product.batchLimit);
    const soldQuantity = finiteMonitoringNumber(product.soldQuantity) || 0;
    if (batchLimit !== null && soldQuantity > batchLimit) {
      failures.push(`${product.productName || product.id} is oversold by ${soldQuantity - batchLimit}.`);
    }
  });

  const secret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
  let events = {};
  if (!secret) {
    failures.push("Monitoring cannot authenticate to the Worker because the shared secret is missing.");
  } else {
    const monitorResponse = UrlFetchApp.fetch(`${PRODUCTION_SITE_URL}/api/monitor`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ secret }),
      muteHttpExceptions: true,
    });
    let monitorPayload = null;
    try {
      monitorPayload = JSON.parse(monitorResponse.getContentText() || "{}");
    } catch {
      failures.push("Worker monitoring endpoint returned invalid JSON.");
    }
    if (monitorResponse.getResponseCode() !== 200 || monitorPayload?.ok !== true) {
      failures.push(`Worker monitoring endpoint is unavailable (HTTP ${monitorResponse.getResponseCode()}).`);
    } else {
      events = monitorPayload.events && typeof monitorPayload.events === "object" ? monitorPayload.events : {};
      if (monitorPayload.currentBatch && monitorPayload.currentBatch !== expectedBatch) {
        failures.push(`Worker snapshot batch ${monitorPayload.currentBatch} does not match Sheets batch ${expectedBatch}.`);
      }
    }
  }

  return { failures: [...new Set(failures)], events };
}

function monitoringMenuSignature(products) {
  return JSON.stringify(
    (Array.isArray(products) ? products : [])
      .map((product) => ({
        id: String(product.id || "").trim(),
        productName: String(product.productName || "").trim(),
        available: product.available === true,
        special: product.special === true,
        priceSgd: finiteMonitoringNumber(product.priceSgd),
        maxQuantity: finiteMonitoringNumber(product.maxQuantity),
        batchLimit: finiteMonitoringNumber(product.batchLimit),
        remainingQuantity: finiteMonitoringNumber(product.remainingQuantity),
        soldQuantity: finiteMonitoringNumber(product.soldQuantity),
        description: String(product.description || "").trim(),
        allergens: String(product.allergens || "").trim(),
        per: String(product.per || "").trim(),
        imageUrl: String(product.imageUrl || "").trim(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

function normalizeMonitoringCalendar(calendar) {
  return (Array.isArray(calendar) ? calendar : [])
    .map((entry) => ({ date: String(entry?.date || "").trim(), open: entry?.open === true }))
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function finiteMonitoringNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function updateProductionHealthAlert(failures) {
  const properties = PropertiesService.getScriptProperties();
  const previous = properties.getProperty(MONITOR_HEALTH_STATE_PROPERTY) || "";
  const current = failures.length ? JSON.stringify([...failures].sort()) : "";
  if (current === previous) return;

  if (failures.length) {
    sendMonitoringEmail(
      "[Swirl Girl ALERT] Production check failed",
      ["The following production checks failed:", "", ...failures.map((failure) => `- ${failure}`), "", `Checked: ${new Date().toISOString()}`]
    );
  } else if (previous) {
    sendMonitoringEmail(
      "[Swirl Girl RECOVERED] Production checks healthy",
      ["All scheduled production checks are passing again.", `Checked: ${new Date().toISOString()}`]
    );
  }
  properties.setProperty(MONITOR_HEALTH_STATE_PROPERTY, current);
}

function notifyNewWorkerEvents(events) {
  const properties = PropertiesService.getScriptProperties();
  let notified = {};
  try {
    notified = JSON.parse(properties.getProperty(MONITOR_EVENT_STATE_PROPERTY) || "{}");
  } catch {
    notified = {};
  }
  const fresh = Object.entries(events || {}).filter(([area, event]) => event?.at && notified[area] !== event.at);
  if (!fresh.length) return;

  sendMonitoringEmail(
    "[Swirl Girl ALERT] Runtime failure recorded",
    fresh.flatMap(([area, event]) => [`${area}: ${event.message || "Operational failure"}`, `Recorded: ${event.at}`, ""])
  );
  fresh.forEach(([area, event]) => { notified[area] = event.at; });
  properties.setProperty(MONITOR_EVENT_STATE_PROPERTY, JSON.stringify(notified));
}

function reportImmediateMonitoringFailure(area, message) {
  try {
    const properties = PropertiesService.getScriptProperties();
    let state = {};
    try {
      state = JSON.parse(properties.getProperty(MONITOR_IMMEDIATE_STATE_PROPERTY) || "{}");
    } catch {
      state = {};
    }
    const now = Date.now();
    if (state[area] && now - Number(state[area]) < MONITOR_ALERT_THROTTLE_MS) return;
    sendMonitoringEmail(
      "[Swirl Girl ALERT] Backend operation failed",
      [`Area: ${area}`, message, `Recorded: ${new Date(now).toISOString()}`]
    );
    state[area] = now;
    properties.setProperty(MONITOR_IMMEDIATE_STATE_PROPERTY, JSON.stringify(state));
  } catch (error) {
    console.error("Unable to send monitoring alert", error);
  }
}

function sendMonitoringEmail(subject, lines) {
  MailApp.sendEmail({
    to: MONITOR_EMAIL,
    subject,
    body: lines.join("\n"),
    name: "Swirl Girl Production Monitor",
  });
}

function publishMenuSnapshot() {
  const productionUrl = PropertiesService.getScriptProperties().getProperty(MENU_SNAPSHOT_URL_PROPERTY);
  const testUrl =
    PropertiesService.getScriptProperties().getProperty(MENU_SNAPSHOT_TEST_URL_PROPERTY) ||
    DEFAULT_MENU_SNAPSHOT_TEST_URL;
  const secret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);

  if (!productionUrl || !secret) {
    return { ok: false, error: "Missing menu snapshot configuration" };
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const calendar = readBakeCalendar(spreadsheet);
  const currentBatch = getMenuBatchDate("", spreadsheet, calendar);
  const currentBatchKey = formatBatchKey(currentBatch);
  const batchKeys = getSnapshotBatchKeys(calendar, currentBatchKey);
  console.log(
    `Publishing menu snapshot: current batch ${currentBatchKey}; calendar entries ${calendar.length}; snapshots ${batchKeys.join(", ")}`
  );
  const productionSnapshots = buildMenuSnapshots(batchKeys, currentBatchKey, calendar, spreadsheet, false);
  const testSnapshots = buildMenuSnapshots(batchKeys, currentBatchKey, calendar, spreadsheet, true);
  logShoppingSnapshot("production", productionSnapshots[currentBatchKey]?.shopping);
  logShoppingSnapshot("test", testSnapshots[currentBatchKey]?.shopping);

  const productionPayload = {
    secret,
    currentBatch: currentBatchKey,
    snapshots: productionSnapshots,
  };
  const productionResult = publishSnapshotToEndpoint(productionUrl, productionPayload, "production");
  const testResult = testUrl && testUrl !== productionUrl
    ? publishSnapshotToEndpoint(
        testUrl,
        {
          secret,
          currentBatch: currentBatchKey,
          snapshots: testSnapshots,
        },
        "test"
      )
    : null;

  return {
    ...productionResult,
    currentBatch: currentBatchKey,
    snapshotCount: batchKeys.length,
    testPublished: testResult?.ok === true,
  };
}

function logShoppingSnapshot(environment, shopping) {
  const itemCount = Array.isArray(shopping?.items) ? shopping.items.length : 0;
  const warnings = Array.isArray(shopping?.warnings) ? shopping.warnings : [];
  console.log(
    `Stock snapshot ${environment}: ${itemCount} ingredient(s); ${warnings.length} warning(s)${warnings.length ? ` - ${warnings.join(" | ")}` : ""}`
  );
}

function testShoppingSnapshot() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const calendar = readBakeCalendar(spreadsheet);
  const batchDate = getMenuBatchDate("", spreadsheet, calendar);
  const batchKey = formatBatchKey(batchDate);
  const products = readMenuSettings(true, batchKey, spreadsheet, calendar, true);
  const shopping = buildShoppingSnapshot(batchKey, spreadsheet, products);
  console.log(JSON.stringify({ batchKey, products: products.map((product) => ({
    id: product.id,
    recipeName: product.recipeName,
    recipeYield: product.recipeYield,
    unitsPerSale: product.unitsPerSale,
  })), shopping }));
  return shopping;
}

function buildMenuSnapshots(batchKeys, currentBatchKey, calendar, spreadsheet, useTestAvailability) {
  return Object.fromEntries(
    batchKeys.map((batchKey) => {
      const products = readMenuSettings(true, batchKey, spreadsheet, calendar, useTestAvailability);
      return [
        batchKey,
        {
          ok: true,
          batchKey,
          defaultBatch: currentBatchKey,
          calendar,
          products,
          // The stock page only needs the next active bake. Keeping its payload in the
          // existing snapshot avoids a second Workers KV read for every phone visit.
          shopping: batchKey === currentBatchKey
            ? buildShoppingSnapshot(batchKey, spreadsheet, products)
            : emptyShoppingSnapshot(batchKey),
        },
      ];
    })
  );
}

function publishSnapshotToEndpoint(url, payload, label) {
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const responseText = response.getContentText() || "";
  console.log(`Menu snapshot ${label} endpoint responded with HTTP ${status}: ${responsePreview(responseText)}`);

  let result;
  try {
    result = JSON.parse(responseText || "{}");
  } catch {
    throw new Error(`Menu snapshot ${label} endpoint returned non-JSON (${status}): ${responsePreview(responseText)}`);
  }

  if (status < 200 || status >= 300 || result.ok !== true) {
    throw new Error(`Unable to publish ${label} menu snapshot (${status}): ${result.error || "unknown error"}`);
  }

  return result;
}

function responsePreview(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function appendOrderRow(sheet, orderRow) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map((header) => normalizeHeader(header));

  const valueByHeader = {
    request_id: orderRow.requestId,
    request_fingerprint: orderRow.requestFingerprint,
    order_no: orderRow.orderNumber,
    order_number: orderRow.orderNumber,
    created_at: orderRow.createdAt,
    status: orderRow.status,
    paid: orderRow.paid,
    name: orderRow.name,
    whatsapp: orderRow.whatsApp,
    phone: orderRow.whatsApp,
    contact_number: orderRow.whatsApp,
    saturday_batch: orderRow.saturdayBatch,
    bake_window: orderRow.saturdayBatch,
    items: orderRow.items,
    total: orderRow.total,
    estimated_total: orderRow.total,
    fulfilment: orderRow.fulfilment,
    fulfillment: orderRow.fulfilment,
    collection_slot: orderRow.collectionSlot,
    pickup_time: orderRow.collectionSlot,
    delivery_address: orderRow.deliveryAddress,
    address: orderRow.deliveryAddress,
    notes: orderRow.notes,
    referral_program_version: orderRow.referralProgramVersion,
    customer_key: orderRow.customerKey,
    customer_referral_code: orderRow.customerReferralCode,
    entered_referral_code: orderRow.enteredReferralCode,
    referral_discount: orderRow.referralDiscount,
    credit_redeemed: orderRow.creditRedeemed,
    credit_source_event_id: orderRow.creditSourceEventId,
    amount_due: orderRow.amountDue,
    referred_by_customer_key: orderRow.referredByCustomerKey,
  };

  const row = headers.map((header) => Object.prototype.hasOwnProperty.call(valueByHeader, header)
    ? valueByHeader[header]
    : "");
  const targetRow = findNextOrderRow(sheet, headers);
  const targetRange = sheet.getRange(targetRow, 1, 1, row.length);
  if (targetRow > 2) {
    const templateRange = sheet.getRange(targetRow - 1, 1, 1, row.length);
    templateRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    templateRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }
  const paidColumn = headers.indexOf("paid");
  if (paidColumn >= 0) sheet.getRange(targetRow, paidColumn + 1).insertCheckboxes();
  targetRange.setValues([row]);
}

function findNextOrderRow(sheet, headers) {
  const orderNumberColumn = Math.max(headers.indexOf("order_no"), headers.indexOf("order_number"));
  if (orderNumberColumn < 0 || sheet.getLastRow() < 2) return 2;
  const values = sheet.getRange(2, orderNumberColumn + 1, sheet.getLastRow() - 1, 1).getValues();
  const firstBlank = values.findIndex((row) => !String(row[0] || "").trim());
  return firstBlank >= 0 ? firstBlank + 2 : sheet.getLastRow() + 1;
}

function ensureOrderRequestColumns(sheet) {
  const required = ["Request ID", "Request Fingerprint", "Referral Program Version", "Customer Key",
    "Customer Referral Code", "Entered Referral Code", "Referral Discount", "Credit Redeemed",
    "Credit Source Event ID", "Amount Due", "Referred By Customer Key"];
  const lastColumn = sheet.getLastColumn();
  const existing = lastColumn
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((header) => normalizeHeader(header))
    : [];

  required.forEach((header) => {
    if (existing.includes(normalizeHeader(header))) return;
    const column = sheet.getLastColumn() + 1;
    sheet.getRange(1, column).setValue(header);
    existing.push(normalizeHeader(header));
  });
}

function findOrderRequest(sheet, requestId) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return null;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((header) => normalizeHeader(header));
  const requestIdColumn = headers.indexOf("request_id");
  const fingerprintColumn = headers.indexOf("request_fingerprint");
  const orderNumberColumn = Math.max(headers.indexOf("order_no"), headers.indexOf("order_number"));
  if (requestIdColumn < 0 || fingerprintColumn < 0 || orderNumberColumn < 0) return null;

  const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const row = rows.find((entry) => String(entry[requestIdColumn] || "").trim() === requestId);
  return row ? {
    requestFingerprint: String(row[fingerprintColumn] || "").trim().toLowerCase(),
    orderNumber: String(row[orderNumberColumn] || "").trim(),
    referral: {
      referralCode: valueFromRow(headers, row, "customer_referral_code"),
      referralDiscountSgd: Number(valueFromRow(headers, row, "referral_discount") || 0),
      creditRedeemedSgd: Number(valueFromRow(headers, row, "credit_redeemed") || 0),
      amountDueSgd: Number(valueFromRow(headers, row, "amount_due") || 0),
    },
  } : null;
}

function valueFromRow(headers, row, header) {
  const column = headers.indexOf(header);
  return column < 0 ? "" : row[column];
}

function validateOrderForWrite(order, spreadsheet) {
  const text = (value, max, required) => {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return (required && !normalized) || normalized.length > max ? null : normalized;
  };
  const name = text(order.name, 80, true);
  const phone = text(order.phone, 40, true);
  const bakeWindow = text(order.bakeWindow, 10, true);
  const delivery = text(order.delivery, 80, true);
  const pickupTime = text(order.pickupTime || "", 40, false);
  const address = text(order.address || "", 300, false);
  const notes = text(order.notes || "", 500, false);
  const referralCode = text(order.referralCode || "", 16, false);
  const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
  const quotedTotalSgd = Number(order.quotedTotalSgd);
  if (
    !name || !phone || phoneDigits.length < 8 || phoneDigits.length > 15 ||
    !getRequestedSaturday(bakeWindow) || !delivery || pickupTime === null || address === null || notes === null || referralCode === null ||
    (referralCode && !/^[a-z0-9]{6,12}$/i.test(referralCode)) ||
    !Number.isFinite(quotedTotalSgd) || quotedTotalSgd < 0 || quotedTotalSgd > 10000 ||
    Math.abs(quotedTotalSgd * 100 - Math.round(quotedTotalSgd * 100)) >= 1e-7 ||
    !Array.isArray(order.lineItems) || order.lineItems.length < 1 || order.lineItems.length > 20
  ) {
    return { ok: false, errorCode: "INVALID_ORDER", error: "Incomplete or invalid order details" };
  }

  const lines = [];
  const ids = {};
  for (let index = 0; index < order.lineItems.length; index += 1) {
    const source = order.lineItems[index];
    const productId = typeof source?.productId === "string" ? source.productId.trim() : "";
    const quantity = Number(source?.quantity);
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(productId) || ids[productId] || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return { ok: false, errorCode: "INVALID_ORDER", error: "Invalid order quantities" };
    }
    ids[productId] = true;
    lines.push({ productId, quantity });
  }

  const bananaChocolateChips = order.bananaChocolateChips === true;
  if ((order.bananaChocolateChips !== undefined && typeof order.bananaChocolateChips !== "boolean") || (bananaChocolateChips && !ids["banana-bread"])) {
    return { ok: false, errorCode: "INVALID_ORDER", error: "Invalid add-on selection" };
  }
  if (delivery === DELIVERY_OPTION) {
    if (!address || pickupTime) return { ok: false, errorCode: "INVALID_ORDER", error: "A delivery address is required" };
  } else if (delivery === COLLECTION_OPTION) {
    if (!PICKUP_WINDOWS.includes(pickupTime) || address) return { ok: false, errorCode: "INVALID_ORDER", error: "A valid pickup time is required" };
  } else {
    return { ok: false, errorCode: "INVALID_ORDER", error: "Invalid fulfilment option" };
  }

  const calendar = readBakeCalendar(spreadsheet);
  const defaultBatch = formatBatchKey(getMenuBatchDate("", spreadsheet, calendar));
  if (bakeWindow < defaultBatch || (calendar.length && !calendar.some((entry) => entry.date === bakeWindow && entry.open))) {
    return { ok: false, errorCode: "ORDER_UNAVAILABLE", error: "The selected bake date is no longer available" };
  }
  const products = readMenuSettings(true, bakeWindow, spreadsheet, calendar, false);
  const productsById = Object.fromEntries(products.map((product) => [product.id, product]));
  const itemParts = [];
  let itemsTotalCents = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const product = productsById[line.productId];
    const priceCents = Math.round(Number(product?.priceSgd) * 100);
    const maxQuantity = Math.floor(Number(product?.maxQuantity || 3));
    const remainingQuantity = product?.remainingQuantity == null ? Infinity : Math.floor(Number(product.remainingQuantity));
    if (
      !product || product.available !== true || !Number.isInteger(priceCents) || priceCents <= 0 ||
      Math.abs(Number(product.priceSgd) * 100 - priceCents) >= 1e-7 ||
      maxQuantity < line.quantity || remainingQuantity < line.quantity
    ) {
      return { ok: false, errorCode: "ORDER_UNAVAILABLE", error: "A selected product or quantity is no longer available" };
    }
    itemsTotalCents += priceCents * line.quantity;
    const per = String(product.per || "").trim().replace(/^per\s+/i, "");
    itemParts.push(`${product.productName || productNameFromId(product.id)}${per ? ` (${per})` : ""} x${line.quantity}`);
  }

  if (bananaChocolateChips) {
    const bananaQuantity = lines.find((line) => line.productId === "banana-bread").quantity;
    itemsTotalCents += BANANA_CHOCOLATE_CHIPS_PRICE_SGD * 100 * bananaQuantity;
    itemParts.push(`Chocolate chips for Banana Cake x${bananaQuantity} (+S$${(BANANA_CHOCOLATE_CHIPS_PRICE_SGD * bananaQuantity).toFixed(2)})`);
  }
  let deliveryFeeCents = 0;
  if (delivery === DELIVERY_OPTION) {
    if (itemsTotalCents < DELIVERY_MINIMUM_SGD * 100) {
      return { ok: false, errorCode: "ORDER_UNAVAILABLE", error: `Delivery requires at least S$${DELIVERY_MINIMUM_SGD.toFixed(2)} of bakes` };
    }
    deliveryFeeCents = DELIVERY_FEE_SGD * 100;
  }
  const totalCents = itemsTotalCents + deliveryFeeCents;
  if (Math.round(quotedTotalSgd * 100) !== totalCents || (order.totalSgd !== undefined && Math.round(Number(order.totalSgd) * 100) !== totalCents)) {
    return { ok: false, errorCode: "PRICE_CHANGED", error: "The menu price changed; refresh and review the order" };
  }

  return { ok: true, order: {
    name, phone, bakeWindow, delivery, pickupTime, address, notes, referralCode: referralCode.toUpperCase(),
    items: itemParts.join(", "),
    estimatedTotal: `S$${(totalCents / 100).toFixed(2)}`,
    itemsTotalSgd: itemsTotalCents / 100,
    totalSgd: totalCents / 100,
  } };
}

function applyReferralToOrder(spreadsheet, ordersSheet, order, orderNumber) {
  ensureReferralSheets(spreadsheet);
  const customerKey = referralCustomerKey(order.phone);
  const customer = getOrCreateReferralCustomer(spreadsheet, customerKey, orderNumber, order.phone);
  const result = { customerKey, referralCode: customer.code, referredByCustomerKey: "", creditSourceEventId: "",
    referralDiscountSgd: 0, creditRedeemedSgd: 0, amountDueSgd: order.totalSgd };
  const qualifying = order.delivery === COLLECTION_OPTION && order.itemsTotalSgd >= REFERRAL_MINIMUM_SGD;
  if (!qualifying) return result;

  const entered = String(order.referralCode || "").toUpperCase();
  const referrer = entered ? findReferralCustomerByCode(spreadsheet, entered) : null;
  if (referrer && referrer.customerKey !== customerKey && isFirstCustomerOrder(ordersSheet, order.phone, customerKey)) {
    result.referralDiscountSgd = REFERRAL_CREDIT_SGD;
    result.referredByCustomerKey = referrer.customerKey;
    result.amountDueSgd -= REFERRAL_CREDIT_SGD;
    return result;
  }

  const credit = findOldestReferralCredit(spreadsheet, ordersSheet, customerKey, new Date());
  if (credit) {
    result.creditRedeemedSgd = REFERRAL_CREDIT_SGD;
    result.amountDueSgd -= REFERRAL_CREDIT_SGD;
    result.creditSourceEventId = credit.eventId;
  }
  return result;
}

function ensureReferralSheets(spreadsheet) {
  let customers = spreadsheet.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME);
  if (!customers) {
    customers = spreadsheet.insertSheet(REFERRAL_CUSTOMERS_SHEET_NAME);
    customers.appendRow(["Customer Key", "Referral Code", "Created At", "Source Order", "Phone"]);
    customers.setFrozenRows(1);
  }
  ensureSheetColumn(customers, "Phone");
  let ledger = spreadsheet.getSheetByName(REFERRAL_LEDGER_SHEET_NAME);
  if (!ledger) {
    ledger = spreadsheet.insertSheet(REFERRAL_LEDGER_SHEET_NAME);
    ledger.appendRow(["Event ID", "Timestamp", "Event Type", "Customer Key", "Referral Code", "Amount SGD",
      "Source Order", "Redemption Order", "Expires At", "Related Event ID", "Detail", "Phone"]);
    ledger.setFrozenRows(1);
  }
  ensureSheetColumn(ledger, "Phone");
}

function ensureSheetColumn(sheet, header) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(normalizeHeader) : [];
  if (!headers.includes(normalizeHeader(header))) sheet.getRange(1, lastColumn + 1).setValue(header);
}

function referralCustomerKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digits)
    .map((value) => (value < 0 ? value + 256 : value).toString(16).padStart(2, "0")).join("");
}

function getOrCreateReferralCustomer(spreadsheet, customerKey, orderNumber, phone) {
  const sheet = spreadsheet.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const existingIndex = values.slice(1).findIndex((row) => String(row[0]) === customerKey);
  if (existingIndex >= 0) {
    if (!values[existingIndex + 1][4]) sheet.getRange(existingIndex + 2, 5).setValue(safeCell(normalizeReferralPhone(phone)));
    return { customerKey, code: String(values[existingIndex + 1][1]), phone: normalizeReferralPhone(phone) };
  }
  let code = "";
  do { code = `SG${Utilities.getUuid().replace(/-/g, "").slice(0, 6).toUpperCase()}`; }
  while (values.slice(1).some((row) => String(row[1]) === code));
  const normalizedPhone = normalizeReferralPhone(phone);
  sheet.appendRow([customerKey, code, new Date(), orderNumber, safeCell(normalizedPhone)]);
  return { customerKey, code, phone: normalizedPhone };
}

function findReferralCustomerByCode(spreadsheet, code) {
  const values = spreadsheet.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME).getDataRange().getValues();
  const row = values.slice(1).find((entry) => String(entry[1]).toUpperCase() === code);
  return row ? { customerKey: String(row[0]), code: String(row[1]), phone: String(row[4] || "") } : null;
}

function findReferralCustomerByKey(spreadsheet, customerKey) {
  const values = spreadsheet.getSheetByName(REFERRAL_CUSTOMERS_SHEET_NAME).getDataRange().getValues();
  const row = values.slice(1).find((entry) => String(entry[0]) === customerKey);
  return row ? { customerKey: String(row[0]), code: String(row[1]), phone: String(row[4] || "") } : null;
}

function normalizeReferralPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function isFirstCustomerOrder(sheet, phone, customerKey) {
  if (sheet.getLastRow() < 2) return true;
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(normalizeHeader);
  const phoneColumn = Math.max(headers.indexOf("whatsapp"), headers.indexOf("phone"), headers.indexOf("contact_number"));
  const keyColumn = headers.indexOf("customer_key");
  const digits = String(phone).replace(/\D/g, "");
  return !values.slice(1).some((row) =>
    (keyColumn >= 0 && String(row[keyColumn]) === customerKey) ||
    (phoneColumn >= 0 && String(row[phoneColumn]).replace(/\D/g, "").includes(digits))
  );
}

function appendReferralLedger(spreadsheet, type, customerKey, code, amount, sourceOrder, redemptionOrder, relatedEventId, detail, expiresAt, phone) {
  const sheet = spreadsheet.getSheetByName(REFERRAL_LEDGER_SHEET_NAME);
  const eventId = Utilities.getUuid();
  sheet.appendRow([eventId, new Date(), type, customerKey, code, amount, sourceOrder, redemptionOrder,
    expiresAt || "", relatedEventId || "", detail || "", safeCell(normalizeReferralPhone(phone))]);
  return eventId;
}

function findOldestReferralCredit(spreadsheet, ordersSheet, customerKey, now) {
  const rows = spreadsheet.getSheetByName(REFERRAL_LEDGER_SHEET_NAME).getDataRange().getValues().slice(1);
  const redeemed = new Set(rows.filter((row) => row[2] === "CREDIT_REDEEMED").map((row) => String(row[9])));
  const orderValues = ordersSheet.getDataRange().getValues();
  const orderHeaders = orderValues[0].map(normalizeHeader);
  orderValues.slice(1).forEach((row) => {
    if (valueFromRow(orderHeaders, row, "order_no") || valueFromRow(orderHeaders, row, "order_number")) {
      const reserved = String(valueFromRow(orderHeaders, row, "credit_source_event_id") || "");
      if (reserved) redeemed.add(reserved);
    }
  });
  return rows.filter((row) => row[2] === "CREDIT_EARNED" && String(row[3]) === customerKey &&
      !redeemed.has(String(row[0])) && new Date(row[8]).getTime() > now.getTime())
    .sort((a, b) => new Date(a[1]) - new Date(b[1]))
    .map((row) => ({ eventId: String(row[0]), sourceOrder: String(row[6]) }))[0] || null;
}

// The saved order is the commitment. Rebuild a missing audit event from that
// row after a transient Sheet failure, including on an exact request replay.
function reconcileReferralLedgerForSavedOrders(spreadsheet, ordersSheet) {
  if (ordersSheet.getLastRow() < 2) return;
  const values = ordersSheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader);
  values.slice(1).forEach((row) => {
    if (String(valueFromRow(headers, row, "referral_program_version")) !== REFERRAL_PROGRAM_VERSION) return;
    const orderNumber = String(valueFromRow(headers, row, "order_no") || valueFromRow(headers, row, "order_number") || "");
    if (!orderNumber) return;
    const customerKey = String(valueFromRow(headers, row, "customer_key") || "");
    const customer = customerKey ? findReferralCustomerByKey(spreadsheet, customerKey) : null;
    if (Number(valueFromRow(headers, row, "referral_discount")) === REFERRAL_CREDIT_SGD &&
        valueFromRow(headers, row, "referred_by_customer_key")) {
      const ledger = spreadsheet.getSheetByName(REFERRAL_LEDGER_SHEET_NAME).getDataRange().getValues().slice(1);
      if (!ledger.some((event) => event[2] === "FRIEND_DISCOUNT" && String(event[6]) === orderNumber)) {
        appendReferralLedger(spreadsheet, "FRIEND_DISCOUNT", customerKey,
          String(valueFromRow(headers, row, "entered_referral_code") || ""), REFERRAL_CREDIT_SGD,
          orderNumber, "", "", String(valueFromRow(headers, row, "referred_by_customer_key")),
          "", customer && customer.phone || "");
      }
    }
    const creditEventId = String(valueFromRow(headers, row, "credit_source_event_id") || "");
    if (Number(valueFromRow(headers, row, "credit_redeemed")) === REFERRAL_CREDIT_SGD && creditEventId) {
      const ledger = spreadsheet.getSheetByName(REFERRAL_LEDGER_SHEET_NAME).getDataRange().getValues().slice(1);
      if (!ledger.some((event) => event[2] === "CREDIT_REDEEMED" && String(event[7]) === orderNumber)) {
        const source = ledger.find((event) => event[2] === "CREDIT_EARNED" && String(event[0]) === creditEventId);
        if (!source || String(source[3]) !== customerKey) throw new Error("Referral credit source missing for saved order");
        appendReferralLedger(spreadsheet, "CREDIT_REDEEMED", customerKey, customer && customer.code || "",
          REFERRAL_CREDIT_SGD, String(source[6]), orderNumber, creditEventId, "FIFO", "",
          customer && customer.phone || "");
      }
    }
  });
}

function processPaidReferralEdit(event) {
  const range = event && event.range;
  if (!range || typeof range.getRow !== "function" || typeof range.getColumn !== "function" ||
      typeof range.getNumRows !== "function" || typeof range.getNumColumns !== "function" ||
      range.getRow() < 2 || range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
  const sheet = range.getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeHeader);
  const editedHeader = headers[range.getColumn() - 1];
  const isPaidEdit = (editedHeader === "paid" && String(event.value || "").toLowerCase() === "true") ||
    (editedHeader === "status" && String(event.value || "").toLowerCase() === "paid");
  if (!isPaidEdit) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const row = sheet.getRange(range.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
    const paidColumn = headers.indexOf("paid");
    const statusColumn = headers.indexOf("status");
    const stillPaid = (paidColumn >= 0 && row[paidColumn] === true) ||
      (statusColumn >= 0 && String(row[statusColumn]).toLowerCase() === "paid");
    if (stillPaid) earnReferralCreditForOrder(sheet.getParent(), headers, row);
  } finally {
    lock.releaseLock();
  }
}

function reconcilePaidReferralOrders(spreadsheet, sheet) {
  if (sheet.getLastRow() < 2) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader);
  const paidColumn = headers.indexOf("paid");
  const statusColumn = headers.indexOf("status");
  values.slice(1).forEach((row) => {
    const paid = paidColumn >= 0 && (row[paidColumn] === true || String(row[paidColumn]).toLowerCase() === "true");
    const legacyPaid = statusColumn >= 0 && String(row[statusColumn]).toLowerCase() === "paid";
    if (paid || legacyPaid) earnReferralCreditForOrder(spreadsheet, headers, row);
  });
}

function earnReferralCreditForOrder(spreadsheet, headers, row) {
  if (String(valueFromRow(headers, row, "referral_program_version")) !== REFERRAL_PROGRAM_VERSION) return;
  const sourceOrder = String(valueFromRow(headers, row, "order_no") || valueFromRow(headers, row, "order_number") || "");
  if (!sourceOrder) return;
  ensureReferralSheets(spreadsheet);
  const ledger = spreadsheet.getSheetByName(REFERRAL_LEDGER_SHEET_NAME).getDataRange().getValues().slice(1);
  const referralEvent = ledger.find((entry) => entry[2] === "FRIEND_DISCOUNT" && String(entry[6]) === sourceOrder);
  const referrerKey = referralEvent ? String(referralEvent[10] || "") : String(valueFromRow(headers, row, "referred_by_customer_key") || "");
  if (!referrerKey) return;
  if (ledger.some((entry) => entry[2] === "CREDIT_EARNED" && String(entry[6]) === sourceOrder)) return;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const earnedThisMonth = ledger.filter((entry) => entry[2] === "CREDIT_EARNED" && String(entry[3]) === referrerKey && new Date(entry[1]) >= monthStart).length;
  if (earnedThisMonth >= REFERRAL_MONTHLY_EARN_CAP) return;
  const expiry = new Date(); expiry.setDate(expiry.getDate() + REFERRAL_EXPIRY_DAYS);
  const referrer = findReferralCustomerByKey(spreadsheet, referrerKey);
  appendReferralLedger(spreadsheet, "CREDIT_EARNED", referrerKey, referrer && referrer.code || "", REFERRAL_CREDIT_SGD,
    sourceOrder, "", "", "Paid order", expiry, referrer && referrer.phone || "");
}

function readMenuPayload(forceRefresh, batchKey, useTestAvailability) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const calendar = readBakeCalendar(spreadsheet);
  const batchDate = getMenuBatchDate(batchKey, spreadsheet, calendar);
  const resolvedBatchKey = formatBatchKey(batchDate);
  const products = readMenuSettings(forceRefresh, resolvedBatchKey, spreadsheet, calendar, useTestAvailability);

  return {
    ok: true,
    batchKey: resolvedBatchKey,
    defaultBatch: formatBatchKey(getMenuBatchDate("", spreadsheet, calendar)),
    calendar,
    products,
    shopping: buildShoppingSnapshot(resolvedBatchKey, spreadsheet, products),
  };
}

function readMenuSettings(forceRefresh, batchKey, spreadsheet, calendar, useTestAvailability) {
  const activeSpreadsheet = spreadsheet || SpreadsheetApp.openById(SPREADSHEET_ID);
  const activeCalendar = calendar || readBakeCalendar(activeSpreadsheet);
  const batchDate = getMenuBatchDate(batchKey, activeSpreadsheet, activeCalendar);
  const resolvedBatchKey = formatBatchKey(batchDate);
  const cacheKey = `${MENU_CACHE_KEY}:${resolvedBatchKey}:${useTestAvailability ? "test" : "production"}`;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached) return JSON.parse(cached);

  const sheet = activeSpreadsheet.getSheetByName(MENU_SETTINGS_SHEET_NAME);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const productRows = values
    .map((row) => {
      const id = String(row[column.product_id] || "").trim();
      if (!id) return null;

      return {
        id,
        productName: String(row[column.product_name] || row[column.product] || productNameFromId(id)).trim(),
      };
    })
    .filter(Boolean);
  const soldByProductId = getSoldQuantitiesForBatch(activeSpreadsheet, productRows, batchDate);

  const products = values
    .map((row) => {
      const id = String(row[column.product_id] || "").trim();
      if (!id) return null;

      const batchLimit = toPositiveNumber(row[column.batch_limit]);
      const soldQuantity = soldByProductId[id] || 0;
      const remainingQuantity = batchLimit === null ? null : Math.max(batchLimit - soldQuantity, 0);

      const productionAvailable = parseBoolean(row[column.available]);
      const testAvailability = parseAvailabilityOverride(row[column.test_available]);
      const available = useTestAvailability && testAvailability !== null ? testAvailability : productionAvailable;

      return {
        id,
        productName: String(row[column.product_name] || row[column.product] || productNameFromId(id)).trim(),
        priceSgd: row[column.price_sgd],
        available,
        special: available && parseOptionalBoolean(row[column.special]),
        maxQuantity: row[column.max_quantity],
        batchLimit,
        soldQuantity,
        remainingQuantity,
        description: row[column.description],
        allergens: row[column.allergens],
        per: row[column.per],
        imageUrl: row[column.image_url],
        recipeName: String(row[column.recipe_name] || "").trim(),
        recipeYield: row[column.recipe_yield],
        unitsPerSale: row[column.units_per_sale],
      };
    })
    .filter(Boolean);

  cache.put(cacheKey, JSON.stringify(products), MENU_CACHE_SECONDS);
  return products;
}

function isTestEnvironment(value) {
  return String(value || "").trim().toLowerCase() === "test";
}

function clearMenuCache() {
  // CacheService has no prefix delete. New snapshots always force a fresh read.
}

function getSoldQuantitiesForBatch(spreadsheet, products, batchDate) {
  const ordersSheet = spreadsheet.getSheetByName(ORDERS_SHEET_NAME);
  if (!ordersSheet || ordersSheet.getLastRow() < 2) {
    return {};
  }

  const values = ordersSheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const soldByProductId = {};
  values.forEach((row) => {
    if (!isSameBatch(row[column.saturday_batch], batchDate)) return;
    if (isCancelledStatus(row[column.status])) return;

    const items = String(row[column.items] || "");
    products.forEach((product) => {
      const productId = typeof product === "string" ? product : product.id;
      const names = typeof product === "string"
        ? productNamesFromId(productId)
        : [...new Set([product.productName, ...productNamesFromId(productId)].filter(Boolean))];
      const quantity = getOrderedQuantity(items, names);
      if (quantity > 0) {
        soldByProductId[productId] = (soldByProductId[productId] || 0) + quantity;
      }
    });
  });

  return soldByProductId;
}

function emptyShoppingSnapshot(batchKey) {
  return { batchKey, items: [], warnings: [], generatedAt: new Date().toISOString() };
}

function buildShoppingSnapshot(batchKey, spreadsheet, products) {
  const recipeSheet = spreadsheet.getSheetByName(RECIPE_SHEET_NAME);
  if (!recipeSheet || recipeSheet.getLastRow() < 2) {
    return {
      ...emptyShoppingSnapshot(batchKey),
      warnings: ["Add recipe rows to the Recipe sheet to create the stock checklist."],
    };
  }

  const batchDate = new Date(`${batchKey}T00:00:00+08:00`);
  const soldByProductId = getSoldQuantitiesForBatch(spreadsheet, products, batchDate);
  const recipes = readRecipeIngredients(recipeSheet);
  const ingredientLocations = readIngredientLocations(spreadsheet.getSheetByName(COSTS_SHEET_NAME));
  const totals = new Map();
  const warnings = [];

  products.forEach((product) => {
    const sold = Number(soldByProductId[product.id] || 0);
    if (sold <= 0) return;

    const recipeKey = normalizeRecipeKey(product.recipeName);
    const recipeIngredients = recipeKey ? recipes.get(recipeKey) : null;
    const recipeYield = toFiniteNumber(product.recipeYield);
    const unitsPerSale = toFiniteNumber(product.unitsPerSale);

    if (!recipeIngredients || !recipeYield || !unitsPerSale) {
      warnings.push(`Add recipe mapping for ${product.productName || product.id}.`);
      return;
    }

    const scale = (sold * unitsPerSale) / recipeYield;
    recipeIngredients.forEach((ingredient) => {
      const key = `${normalizeHeader(ingredient.name)}:${normalizeHeader(ingredient.unit)}`;
      const current = totals.get(key) || {
        id: key,
        name: ingredient.name,
        unit: ingredient.unit,
        location: ingredientLocations.get(normalizeHeader(ingredient.name)) || "Other ingredients",
        quantity: 0,
        forProducts: [],
      };
      current.quantity += ingredient.quantity * scale;
      if (!current.forProducts.includes(product.productName || product.id)) {
        current.forProducts.push(product.productName || product.id);
      }
      totals.set(key, current);
    });
  });

  const items = [...totals.values()]
    .map((item) => ({
      ...item,
      quantity: Math.round(item.quantity * 100) / 100,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { batchKey, items, warnings, generatedAt: new Date().toISOString() };
}

function readRecipeIngredients(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const recipeColumn = column.recipe;
  const ingredientColumn = column.ingredient;
  const amountColumn = column.amount ?? column.ammount ?? column.quantity;
  const unitColumn = column.g_ml ?? column.unit ?? column.units;

  if (recipeColumn === undefined || ingredientColumn === undefined || amountColumn === undefined) {
    return new Map();
  }

  const recipes = new Map();
  values.forEach((row) => {
    const recipeKey = normalizeRecipeKey(row[recipeColumn]);
    const name = String(row[ingredientColumn] || "").trim();
    const quantity = toFiniteNumber(row[amountColumn]);
    if (!recipeKey || !name || !quantity) return;

    const ingredients = recipes.get(recipeKey) || [];
    ingredients.push({
      name,
      quantity,
      unit: String(unitColumn === undefined ? "" : row[unitColumn] || "").trim(),
    });
    recipes.set(recipeKey, ingredients);
  });

  return recipes;
}

function readIngredientLocations(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return new Map();

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const ingredientColumn = column.cost_tracker ?? column.ingredient ?? column.ingredients;
  const locationColumn = column.location ?? column.storage_location;

  if (ingredientColumn === undefined || locationColumn === undefined) return new Map();

  const locations = new Map();
  values.forEach((row) => {
    const ingredient = normalizeHeader(row[ingredientColumn]);
    const location = String(row[locationColumn] || "").trim();
    if (ingredient && location) locations.set(ingredient, location);
  });
  return locations;
}

function normalizeRecipeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/cinnamon/g, "cinamon")
    .replace(/\b\d+\s*x?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toFiniteNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function readBakeCalendar(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(BAKE_CALENDAR_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const dateColumn = column.date ?? column.bake_date;
  const openColumn = column.open ?? column.available;

  if (dateColumn === undefined || openColumn === undefined) return [];

  const byDate = new Map();
  values.forEach((row) => {
    const date = parseCalendarDate(row[dateColumn]);
    if (!date || date.getDay() !== 6) return;

    const key = formatBatchKey(date);
    byDate.set(key, { date: key, open: parseBoolean(row[openColumn]) });
  });

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function parseCalendarDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(`${Utilities.formatDate(value, Session.getScriptTimeZone() || "Asia/Singapore", "yyyy-MM-dd")}T00:00:00+08:00`);
  }

  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+08:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00+08:00`);
  }

  return null;
}

function getMenuBatchDate(batchKey, spreadsheet, calendar) {
  const requested = getRequestedSaturday(batchKey) || getCurrentBatchDate();
  const activeCalendar = calendar || readBakeCalendar(spreadsheet || SpreadsheetApp.openById(SPREADSHEET_ID));
  const openDates = activeCalendar.filter((entry) => entry.open).map((entry) => entry.date);

  // An empty Calendar tab preserves the original weekly schedule until dates are added.
  if (!openDates.length) return requested;

  const requestedKey = formatBatchKey(requested);
  const nextOpenKey = openDates.find((date) => date >= requestedKey);
  return nextOpenKey ? new Date(`${nextOpenKey}T00:00:00+08:00`) : requested;
}

function getRequestedSaturday(batchKey) {
  if (typeof batchKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(batchKey)) return null;

  const requested = new Date(`${batchKey}T00:00:00+08:00`);
  return !Number.isNaN(requested.getTime()) && requested.getDay() === 6 ? requested : null;
}

function getSnapshotBatchKeys(calendar, currentBatchKey) {
  const futureOpenKeys = calendar
    .filter((entry) => entry.open && entry.date >= currentBatchKey)
    .map((entry) => entry.date)
    .slice(0, 16);

  // Retain the existing two-batch behaviour if the Calendar has not been populated yet.
  if (!futureOpenKeys.length) {
    const following = new Date(`${currentBatchKey}T00:00:00+08:00`);
    following.setDate(following.getDate() + 7);
    return [currentBatchKey, formatBatchKey(following)];
  }

  return [...new Set([currentBatchKey, ...futureOpenKeys])];
}

function formatBatchKey(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || "Asia/Singapore", "yyyy-MM-dd");
}

function getCurrentBatchDate() {
  const now = new Date();
  const timezone = Session.getScriptTimeZone() || "Asia/Singapore";
  const localDate = new Date(Utilities.formatDate(now, timezone, "yyyy/MM/dd HH:mm:ss"));
  const day = localDate.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = new Date(localDate);
  saturday.setDate(localDate.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);

  const cutoff = new Date(saturday);
  cutoff.setDate(saturday.getDate() - 2);
  cutoff.setHours(22, 0, 0, 0);

  if (localDate > cutoff) {
    saturday.setDate(saturday.getDate() + 7);
  }

  return saturday;
}

function isSameBatch(value, batchDate) {
  if (!value) return false;

  const timezone = Session.getScriptTimeZone() || "Asia/Singapore";
  const targetKey = Utilities.formatDate(batchDate, timezone, "yyyy-MM-dd");
  const targetLabel = Utilities.formatDate(batchDate, timezone, "EEE, d MMM yyyy")
    .toLowerCase()
    .replace(/,/g, "");

  if (value instanceof Date) {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd") === targetKey;
  }

  const text = String(value).trim().toLowerCase().replace(/,/g, "");
  if (text === targetLabel || text === targetKey) return true;

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && Utilities.formatDate(parsed, timezone, "yyyy-MM-dd") === targetKey;
}

function isCancelledStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["cancelled", "canceled", "void", "refunded", "rejected"].includes(status);
}

function productNamesFromId(productId) {
  if (String(productId || "").trim().toLowerCase() === "banana-bread") {
    // Keep existing orders in stock calculations after the customer-facing rename.
    return ["Banana Cake", "Banana Loaf", "Banana Bread"];
  }

  return [productNameFromId(productId)];
}

function productNameFromId(productId) {
  return String(productId || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderedQuantity(items, productNames) {
  const names = [...new Set((Array.isArray(productNames) ? productNames : [productNames]).filter(Boolean))]
    .map((name) => ({
      raw: String(name).trim(),
      normalized: normalizeOrderItemLabel(name),
    }))
    .filter((entry) => entry.normalized)
    .sort((a, b) => b.normalized.length - a.normalized.length);
  let total = 0;

  String(items || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const quantityMatch = part.match(/x\s*(\d+)\s*$/i);
      if (!quantityMatch) return;

      const quantity = Number(quantityMatch[1] || 0);
      if (!quantity) return;

      const label = normalizeOrderItemLabel(part.replace(/x\s*\d+\s*$/i, ""));
      const matchedName = names.find((entry) => (
        label === entry.normalized ||
        label.startsWith(`${entry.normalized} (`)
      ));

      if (matchedName) {
        total += quantity;
      }
    });

  return total;
}

function normalizeOrderItemLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getNextOrderNumber() {
  const properties = PropertiesService.getScriptProperties();
  const current = Number(properties.getProperty(ORDER_SEQUENCE_PROPERTY) || 0);
  const next = current + 1;
  properties.setProperty(ORDER_SEQUENCE_PROPERTY, String(next));
  return `SG-${String(next).padStart(4, "0")}`;
}

function whatsAppLink(value) {
  const raw = String(value || "");
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return safeCell(raw);
  }

  const internationalDigits = digits.startsWith("65") ? digits : `65${digits}`;
  const label = raw || `+${internationalDigits}`;

  return `=HYPERLINK("https://wa.me/${internationalDigits}","${label.replace(/"/g, '""')}")`;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function safeCell(value) {
  const text = String(value || "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  if (["true", "yes", "y", "1", "available", "on"].includes(text)) return true;
  if (["false", "no", "n", "0", "sold out", "soldout", "off"].includes(text)) return false;
  return true;
}

function parseOptionalBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "on"].includes(text);
}

function parseAvailabilityOverride(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return parseBoolean(value);
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}
