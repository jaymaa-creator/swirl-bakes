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
  queueMenuSnapshotSync(sheetName);
}

function queueMenuSnapshotSync(sheetName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10 * 1000);

  try {
    const queued = ScriptApp.getProjectTriggers().some(
      (trigger) => trigger.getHandlerFunction() === MENU_SYNC_TRIGGER_HANDLER
    );

    if (queued) {
      console.log(`Menu snapshot already queued; bundled edit from ${sheetName}.`);
      return;
    }

    ScriptApp.newTrigger(MENU_SYNC_TRIGGER_HANDLER)
      .timeBased()
      .after(MENU_SYNC_DELAY_MS)
      .create();
    console.log(`Menu snapshot queued from ${sheetName}; publishing in about 60 seconds.`);
  } finally {
    lock.releaseLock();
  }
}

function publishQueuedMenuSnapshot() {
  console.log("Publishing queued menu snapshot after the 60-second edit window.");
  const result = publishMenuSnapshot();
  console.log(`Queued menu snapshot sync completed for ${result.currentBatch || "the current batch"}.`);
  return result;
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
