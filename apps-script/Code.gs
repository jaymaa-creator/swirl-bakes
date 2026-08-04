const SPREADSHEET_ID = "12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A";
const ORDERS_SHEET_NAME = "Orders";
const MENU_SETTINGS_SHEET_NAME = "Products";
const SECRET_PROPERTY = "ORDER_WEBHOOK_SECRET";
const ORDER_SEQUENCE_PROPERTY = "ORDER_SEQUENCE";
const MENU_CONFIGURATION_CACHE_KEY = "menu-configuration-v1";
const MENU_CONFIGURATION_CACHE_SECONDS = 300;
const MENU_AVAILABILITY_CACHE_KEY = "menu-availability-v1";
const MENU_AVAILABILITY_CACHE_SECONDS = 15;

function doGet() {
  try {
    return jsonResponse({
      ok: true,
      products: readMenuSettings(),
    });
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

    if (payload.action === "menuConfiguration") {
      return jsonResponse({
        ok: true,
        products: readMenuConfiguration(),
      });
    }

    if (payload.action === "menuAvailability") {
      return jsonResponse({
        ok: true,
        products: readMenuAvailability(),
      });
    }

    if (payload.action === "menuSettings") {
      return jsonResponse({
        ok: true,
        products: readMenuSettings(),
      });
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
      CacheService.getScriptCache().remove(MENU_AVAILABILITY_CACHE_KEY);
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

function readMenuSettings() {
  const configurationById = new Map(
    readMenuConfiguration().map((product) => [product.id, product])
  );

  return readMenuAvailability().map((availability) => ({
    ...configurationById.get(availability.id),
    ...availability,
  }));
}

function readMenuConfiguration() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(MENU_CONFIGURATION_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(MENU_SETTINGS_SHEET_NAME);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const products = values
    .map((row) => {
      const id = String(row[column.product_id] || "").trim();
      if (!id) return null;

      return {
        id,
        priceSgd: row[column.price_sgd],
        maxQuantity: row[column.max_quantity],
        description: row[column.description],
        allergens: row[column.allergens],
        imageUrl: row[column.image_url],
      };
    })
    .filter(Boolean);

  cache.put(MENU_CONFIGURATION_CACHE_KEY, JSON.stringify(products), MENU_CONFIGURATION_CACHE_SECONDS);
  return products;
}

function readMenuAvailability() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(MENU_AVAILABILITY_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(MENU_SETTINGS_SHEET_NAME);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const productIds = values
    .map((row) => String(row[column.product_id] || "").trim())
    .filter(Boolean);
  const soldByProductId = getSoldQuantitiesForCurrentBatch(spreadsheet, productIds);

  const products = values
    .map((row) => {
      const id = String(row[column.product_id] || "").trim();
      if (!id) return null;

      const batchLimit = toPositiveNumber(row[column.batch_limit]);
      const soldQuantity = soldByProductId[id] || 0;
      const remainingQuantity = batchLimit === null ? null : Math.max(batchLimit - soldQuantity, 0);

      return {
        id,
        available: parseBoolean(row[column.available]),
        maxQuantity: row[column.max_quantity],
        batchLimit,
        soldQuantity,
        remainingQuantity,
      };
    })
    .filter(Boolean);

  cache.put(MENU_AVAILABILITY_CACHE_KEY, JSON.stringify(products), MENU_AVAILABILITY_CACHE_SECONDS);
  return products;
}

function getSoldQuantitiesForCurrentBatch(spreadsheet, productIds) {
  const ordersSheet = spreadsheet.getSheetByName(ORDERS_SHEET_NAME);
  if (!ordersSheet || ordersSheet.getLastRow() < 2) {
    return {};
  }

  const values = ordersSheet.getDataRange().getValues();
  const headers = values.shift().map((header) => normalizeHeader(header));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const batchDate = getCurrentBatchDate();
  const soldByProductId = {};
  values.forEach((row) => {
    if (!isSameBatch(row[column.saturday_batch], batchDate)) return;
    if (isCancelledStatus(row[column.status])) return;

    const items = String(row[column.items] || "");
    productIds.forEach((productId) => {
      const productName = productNameFromId(productId);
      const quantity = getOrderedQuantity(items, productName);
      if (quantity > 0) {
        soldByProductId[productId] = (soldByProductId[productId] || 0) + quantity;
      }
    });
  });

  return soldByProductId;
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

function productNameFromId(productId) {
  return String(productId || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getOrderedQuantity(items, productName) {
  const pattern = new RegExp(`${escapeRegExp(productName)}[^,]*?x\\s*(\\d+)`, "gi");
  let total = 0;
  let match;

  while ((match = pattern.exec(items)) !== null) {
    total += Number(match[1] || 0);
  }

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
