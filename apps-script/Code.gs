const SPREADSHEET_ID = "12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A";
const ORDERS_SHEET_NAME = "Orders";
const MENU_SETTINGS_SHEET_NAME = "Products";
const BAKE_CALENDAR_SHEET_NAME = "Calendar";
const SECRET_PROPERTY = "ORDER_WEBHOOK_SECRET";
const MENU_SNAPSHOT_URL_PROPERTY = "MENU_SNAPSHOT_URL";
const ORDER_SEQUENCE_PROPERTY = "ORDER_SEQUENCE";
const MENU_CACHE_KEY = "live-menu-settings-v1";
const MENU_CACHE_SECONDS = 300;

function doGet(event) {
  try {
    return jsonResponse(readMenuPayload(false, event && event.parameter && event.parameter.batch));
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
      return jsonResponse(readMenuPayload(false, payload.batch));
    }

    const order = payload.order || {};
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ORDERS_SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ ok: false, error: `Missing "${ORDERS_SHEET_NAME}" sheet` });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let orderNumber = "";
    try {
      orderNumber = getNextOrderNumber();
      appendOrderRow(sheet, {
        orderNumber,
        createdAt: new Date(),
        status: "New",
        name: safeCell(order.name),
        whatsApp: whatsAppLink(order.phone),
        saturdayBatch: safeCell(order.bakeWindow),
        items: safeCell(order.items),
        total: safeCell(order.estimatedTotal),
        fulfilment: safeCell(order.delivery),
        collectionSlot: safeCell(order.pickupTime),
        deliveryAddress: safeCell(order.address),
        notes: safeCell(order.notes),
      });

      // Order quantities are part of the menu snapshot. A sync failure must not reject an order
      // that was successfully written to the sheet.
      try {
        publishMenuSnapshot();
      } catch (syncError) {
        console.error(syncError);
      }
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true, orderNumber });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "Invalid order payload" });
  }
}

function setupMenuSettings() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(MENU_SETTINGS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(MENU_SETTINGS_SHEET_NAME);
  }

  sheet.clear();
  sheet.appendRow(["product_id", "price_sgd", "available", "max_quantity", "batch_limit", "description", "allergens", "image_url"]);
  sheet.appendRow(["cinnamon-rolls", 35, true, 3, 12, "", "", ""]);
  sheet.appendRow(["banana-bread", 25, true, 3, 6, "", "", ""]);
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
        },
      }),
    },
  });

  console.log(result.getContent());
}

function syncMenuSnapshot() {
  console.log("Starting manual menu snapshot sync");
  const result = publishMenuSnapshot();
  console.log(`Menu snapshot sync completed for ${result.currentBatch || "the current batch"}`);
  return result;
}

function installMenuSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "onMenuSheetEdit")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("onMenuSheetEdit")
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();
}

function onMenuSheetEdit(event) {
  const sheetName = event && event.range && event.range.getSheet().getName();
  if (
    sheetName !== MENU_SETTINGS_SHEET_NAME &&
    sheetName !== ORDERS_SHEET_NAME &&
    sheetName !== BAKE_CALENDAR_SHEET_NAME
  ) {
    return;
  }

  clearMenuCache();
  console.log(`Menu snapshot sync triggered by an edit to ${sheetName}`);
  publishMenuSnapshot();
}

function publishMenuSnapshot() {
  const url = PropertiesService.getScriptProperties().getProperty(MENU_SNAPSHOT_URL_PROPERTY);
  const secret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);

  if (!url || !secret) {
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
  const snapshots = Object.fromEntries(
    batchKeys.map((batchKey) => [
      batchKey,
      {
        // Keep the KV publish payload compatible with the current production Worker.
        // The public menu endpoint still returns the richer calendar-aware response.
        products: readMenuSettings(true, batchKey, spreadsheet, calendar),
      },
    ])
  );
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      secret,
      currentBatch: currentBatchKey,
      snapshots: Object.fromEntries(
        Object.entries(snapshots).map(([batchKey, snapshot]) => [batchKey, snapshot.products])
      ),
    }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const responseText = response.getContentText() || "";
  console.log(`Menu snapshot endpoint responded with HTTP ${status}: ${responsePreview(responseText)}`);

  let result;
  try {
    result = JSON.parse(responseText || "{}");
  } catch {
    throw new Error(`Menu snapshot endpoint returned non-JSON (${status}): ${responsePreview(responseText)}`);
  }

  if (status < 200 || status >= 300 || result.ok !== true) {
    throw new Error(`Unable to publish menu snapshot (${status}): ${result.error || "unknown error"}`);
  }

  return { ...result, currentBatch: currentBatchKey, snapshotCount: batchKeys.length };
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
    order_no: orderRow.orderNumber,
    order_number: orderRow.orderNumber,
    created_at: orderRow.createdAt,
    status: orderRow.status,
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
  };

  const row = headers.map((header) => valueByHeader[header] || "");
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function readMenuPayload(forceRefresh, batchKey) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const calendar = readBakeCalendar(spreadsheet);
  const batchDate = getMenuBatchDate(batchKey, spreadsheet, calendar);
  const resolvedBatchKey = formatBatchKey(batchDate);

  return {
    ok: true,
    batchKey: resolvedBatchKey,
    defaultBatch: formatBatchKey(getMenuBatchDate("", spreadsheet, calendar)),
    calendar,
    products: readMenuSettings(forceRefresh, resolvedBatchKey, spreadsheet, calendar),
  };
}

function readMenuSettings(forceRefresh, batchKey, spreadsheet, calendar) {
  const activeSpreadsheet = spreadsheet || SpreadsheetApp.openById(SPREADSHEET_ID);
  const activeCalendar = calendar || readBakeCalendar(activeSpreadsheet);
  const batchDate = getMenuBatchDate(batchKey, activeSpreadsheet, activeCalendar);
  const resolvedBatchKey = formatBatchKey(batchDate);
  const cacheKey = `${MENU_CACHE_KEY}:${resolvedBatchKey}`;
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
  const productIds = values
    .map((row) => String(row[column.product_id] || "").trim())
    .filter(Boolean);
  const soldByProductId = getSoldQuantitiesForBatch(activeSpreadsheet, productIds, batchDate);

  const products = values
    .map((row) => {
      const id = String(row[column.product_id] || "").trim();
      if (!id) return null;

      const batchLimit = toPositiveNumber(row[column.batch_limit]);
      const soldQuantity = soldByProductId[id] || 0;
      const remainingQuantity = batchLimit === null ? null : Math.max(batchLimit - soldQuantity, 0);

      return {
        id,
        priceSgd: row[column.price_sgd],
        available: parseBoolean(row[column.available]),
        maxQuantity: row[column.max_quantity],
        batchLimit,
        soldQuantity,
        remainingQuantity,
        description: row[column.description],
        allergens: row[column.allergens],
        imageUrl: row[column.image_url],
      };
    })
    .filter(Boolean);

  cache.put(cacheKey, JSON.stringify(products), MENU_CACHE_SECONDS);
  return products;
}

function clearMenuCache() {
  // CacheService has no prefix delete. New snapshots always force a fresh read.
}

function getSoldQuantitiesForBatch(spreadsheet, productIds, batchDate) {
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
    productIds.forEach((productId) => {
      const quantity = getOrderedQuantity(items, productNamesFromId(productId));
      if (quantity > 0) {
        soldByProductId[productId] = (soldByProductId[productId] || 0) + quantity;
      }
    });
  });

  return soldByProductId;
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
  const names = Array.isArray(productNames) ? productNames : [productNames];
  let total = 0;
  names.forEach((productName) => {
    const pattern = new RegExp(`${escapeRegExp(productName)}[^,]*?x\\s*(\\d+)`, "gi");
    let match;

    while ((match = pattern.exec(items)) !== null) {
      total += Number(match[1] || 0);
    }
  });

  return total;
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

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}
