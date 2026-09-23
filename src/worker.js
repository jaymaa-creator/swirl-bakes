import { resolveMenuBatchKey } from "./lib/batchSelection.js";
import {
  BANANA_CHOCOLATE_CHIPS_PRICE_SGD,
  COLLECTION_OPTION,
  DELIVERY_FEE_SGD,
  DELIVERY_MINIMUM_SGD,
  DELIVERY_OPTION,
  PICKUP_WINDOWS,
} from "./config/orderPolicy.js";

const ORDER_ENDPOINT = "/api/orders";
const MENU_ENDPOINT = "/api/menu";
const MENU_SYNC_ENDPOINT = "/api/menu/sync";
const STOCK_ENDPOINT = "/api/stock";
const MONITOR_ENDPOINT = "/api/monitor";
// Keep every published batch in one value. A full sheet sync therefore costs one
// KV write per environment instead of a write (and cleanup) for every batch.
const MENU_SNAPSHOT_KEY = "menu-snapshots-v1";
const LEGACY_MENU_SNAPSHOT_KEY = "current";
const MAX_ORDER_BYTES = 16_000;
const MENU_FALLBACK_CACHE_SECONDS = 300;
const EDGE_CACHE_VERSION = "v4";
const MONITOR_STATE_KEY = "production-monitor-v1";
const MONITOR_EVENT_THROTTLE_MS = 60 * 60 * 1000;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function jsonResponse(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

async function recordOperationalFailure(env, area, message) {
  if (!env.MENU_SNAPSHOT?.get || !env.MENU_SNAPSHOT?.put) return;

  try {
    const now = Date.now();
    const state = await env.MENU_SNAPSHOT.get(MONITOR_STATE_KEY, "json") || { events: {} };
    const previous = state.events?.[area];
    if (previous?.at && now - Date.parse(previous.at) < MONITOR_EVENT_THROTTLE_MS) return;

    await env.MENU_SNAPSHOT.put(MONITOR_STATE_KEY, JSON.stringify({
      events: {
        ...(state.events || {}),
        [area]: { at: new Date(now).toISOString(), message },
      },
    }));
  } catch (error) {
    console.error("Unable to record operational failure", error);
  }
}

function normalizedText(value, { required = false, max }) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if ((required && !text) || text.length > max) return null;
  return text;
}

function hasAtMostTwoDecimalPlaces(value) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

function normalizeOrderRequest(payload) {
  const requestId = typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
  const order = payload?.order;
  if (!REQUEST_ID_PATTERN.test(requestId) || !order || typeof order !== "object" || Array.isArray(order)) {
    return { error: "Invalid order request" };
  }

  const name = normalizedText(order.name, { required: true, max: 80 });
  const phone = normalizedText(order.phone, { required: true, max: 40 });
  const bakeWindow = normalizedText(order.bakeWindow, { required: true, max: 10 });
  const delivery = normalizedText(order.delivery, { required: true, max: 80 });
  const pickupTime = normalizedText(order.pickupTime ?? "", { max: 40 });
  const address = normalizedText(order.address ?? "", { max: 300 });
  const notes = normalizedText(order.notes ?? "", { max: 500 });
  const phoneDigits = phone?.replace(/\D/g, "") || "";
  const quotedTotalSgd = Number(order.quotedTotalSgd);

  if (
    !name || !phone || phoneDigits.length < 8 || phoneDigits.length > 15 ||
    !bakeWindow || !/^\d{4}-\d{2}-\d{2}$/.test(bakeWindow) ||
    !delivery || pickupTime === null || address === null || notes === null ||
    !Number.isFinite(quotedTotalSgd) || quotedTotalSgd < 0 || quotedTotalSgd > 10_000 ||
    !hasAtMostTwoDecimalPlaces(quotedTotalSgd) ||
    !Array.isArray(order.lineItems) || order.lineItems.length < 1 || order.lineItems.length > 20
  ) {
    return { error: "Incomplete or invalid order details" };
  }

  const lineItems = [];
  const productIds = new Set();
  for (const line of order.lineItems) {
    const productId = typeof line?.productId === "string" ? line.productId.trim() : "";
    const quantity = Number(line?.quantity);
    if (
      !PRODUCT_ID_PATTERN.test(productId) || productIds.has(productId) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 100
    ) {
      return { error: "Invalid order quantities" };
    }
    productIds.add(productId);
    lineItems.push({ productId, quantity });
  }

  const bananaChocolateChips = order.bananaChocolateChips === true;
  if (order.bananaChocolateChips !== undefined && typeof order.bananaChocolateChips !== "boolean") {
    return { error: "Invalid add-on selection" };
  }
  if (bananaChocolateChips && !productIds.has("banana-bread")) {
    return { error: "Invalid add-on selection" };
  }

  if (delivery === DELIVERY_OPTION) {
    if (!address || pickupTime) return { error: "A delivery address is required" };
  } else if (delivery === COLLECTION_OPTION) {
    if (!PICKUP_WINDOWS.includes(pickupTime) || address) return { error: "A valid pickup time is required" };
  } else {
    return { error: "Invalid fulfilment option" };
  }

  return {
    requestId,
    order: {
      name,
      phone,
      bakeWindow,
      delivery,
      pickupTime,
      address,
      notes,
      lineItems: lineItems.sort((a, b) => a.productId.localeCompare(b.productId)),
      bananaChocolateChips,
      quotedTotalSgd,
    },
  };
}

async function orderFingerprint(order) {
  const bytes = new TextEncoder().encode(JSON.stringify(order));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function productLabel(product) {
  const name = product.productName || product.id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const per = typeof product.per === "string" ? product.per.trim().replace(/^per\s+/i, "") : "";
  return per ? `${name} (${per})` : name;
}

function validateOrderAgainstMenu(order, menu) {
  if (!menu || menu.batchKey !== order.bakeWindow) {
    return { error: "The selected bake date is no longer available", status: 409 };
  }
  if (menu.calendar?.length) {
    const calendarEntry = menu.calendar.find((entry) => entry.date === order.bakeWindow);
    if (!calendarEntry?.open) return { error: "The selected bake date is closed", status: 409 };
  }

  const products = new Map(menu.products.map((product) => [product.id, product]));
  const itemParts = [];
  let itemsTotalCents = 0;
  for (const line of order.lineItems) {
    const product = products.get(line.productId);
    const priceCents = Math.round(Number(product?.priceSgd) * 100);
    const maxQuantity = Math.floor(Number(product?.maxQuantity));
    const remainingQuantity = product?.remainingQuantity == null
      ? Number.POSITIVE_INFINITY
      : Math.floor(Number(product.remainingQuantity));
    if (
      !product || product.available !== true || !Number.isInteger(priceCents) || priceCents <= 0 ||
      !hasAtMostTwoDecimalPlaces(Number(product.priceSgd))
    ) {
      return { error: "One or more selected products are unavailable", status: 409 };
    }
    if (!Number.isInteger(maxQuantity) || maxQuantity < line.quantity || remainingQuantity < line.quantity) {
      return { error: "A selected quantity is no longer available", status: 409 };
    }
    itemsTotalCents += priceCents * line.quantity;
    itemParts.push(`${productLabel(product)} x${line.quantity}`);
  }

  if (order.bananaChocolateChips) {
    const bananaQuantity = order.lineItems.find((line) => line.productId === "banana-bread")?.quantity || 0;
    itemsTotalCents += BANANA_CHOCOLATE_CHIPS_PRICE_SGD * 100 * bananaQuantity;
    itemParts.push(`Chocolate chips for Banana Cake x${bananaQuantity} (+S$${(
      BANANA_CHOCOLATE_CHIPS_PRICE_SGD * bananaQuantity
    ).toFixed(2)})`);
  }

  let deliveryFeeCents = 0;
  if (order.delivery === DELIVERY_OPTION) {
    if (itemsTotalCents < DELIVERY_MINIMUM_SGD * 100) {
      return { error: `Delivery requires at least S$${DELIVERY_MINIMUM_SGD.toFixed(2)} of bakes`, status: 409 };
    }
    deliveryFeeCents = DELIVERY_FEE_SGD * 100;
  }
  const totalCents = itemsTotalCents + deliveryFeeCents;
  if (Math.round(order.quotedTotalSgd * 100) !== totalCents) {
    return { error: "The menu price changed; refresh and review the order", status: 409 };
  }

  return {
    order: {
      ...order,
      items: itemParts.join(", "),
      itemsTotalSgd: itemsTotalCents / 100,
      deliveryFeeSgd: deliveryFeeCents / 100,
      totalSgd: totalCents / 100,
      estimatedTotal: `S$${(totalCents / 100).toFixed(2)}`,
    },
  };
}

function normalizeMenuProduct(product) {
  if (!product || typeof product.id !== "string" || !product.id.trim()) return null;

  const finiteNumber = (value) => {
    if (value === null || value === undefined || value === "") return undefined;

    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  };

  return {
    id: product.id.trim(),
    productName: typeof product.productName === "string" ? product.productName.trim() : undefined,
    priceSgd: finiteNumber(product.priceSgd),
    available: product.available,
    special: product.special === true,
    batchLimit: finiteNumber(product.batchLimit),
    maxQuantity: finiteNumber(product.maxQuantity),
    description: typeof product.description === "string" ? product.description.trim() : undefined,
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl.trim() : undefined,
    allergens: typeof product.allergens === "string" ? product.allergens.trim() : undefined,
    per: typeof product.per === "string" ? product.per.trim() : undefined,
    remainingQuantity: finiteNumber(product.remainingQuantity),
    soldQuantity: finiteNumber(product.soldQuantity),
  };
}

function normalizeCalendar(calendar) {
  if (!Array.isArray(calendar)) return [];

  return calendar
    .map((entry) => {
      if (!entry || typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
        return null;
      }

      return { date: entry.date, open: entry.open === true };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeShoppingSnapshot(shopping) {
  const source = shopping && typeof shopping === "object" ? shopping : {};
  const items = Array.isArray(source.items) ? source.items : [];

  return {
    batchKey: typeof source.batchKey === "string" ? source.batchKey : "",
    generatedAt: typeof source.generatedAt === "string" ? source.generatedAt : "",
    warnings: Array.isArray(source.warnings)
      ? source.warnings.filter((warning) => typeof warning === "string").slice(0, 20)
      : [],
    items: items
      .map((item) => {
        if (!item || typeof item.name !== "string") return null;
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;

        return {
          id: typeof item.id === "string" ? item.id : item.name.toLowerCase(),
          name: item.name.trim(),
          unit: typeof item.unit === "string" ? item.unit.trim() : "",
          location: typeof item.location === "string" && item.location.trim()
            ? item.location.trim().slice(0, 80)
            : "Other ingredients",
          quantity,
          forProducts: Array.isArray(item.forProducts)
            ? item.forProducts.filter((product) => typeof product === "string").slice(0, 10)
            : [],
        };
      })
      .filter(Boolean),
  };
}

function normalizeMenuSnapshot(snapshot) {
  const source = Array.isArray(snapshot) ? { products: snapshot } : snapshot;
  if (!source || !Array.isArray(source.products)) return null;

  return {
    ok: true,
    batchKey: typeof source.batchKey === "string" ? source.batchKey : "",
    defaultBatch: typeof source.defaultBatch === "string" ? source.defaultBatch : "",
    calendar: normalizeCalendar(source.calendar),
    products: source.products.map(normalizeMenuProduct).filter(Boolean),
    shopping: normalizeShoppingSnapshot(source.shopping),
  };
}

async function fetchMenuSettings(env, batchKey, useTestAvailability) {
  const menuSettingsUrl = env.MENU_SETTINGS_URL || env.ORDER_SHEET_WEBHOOK_URL;

  if (!menuSettingsUrl) {
    return { ok: true, products: [] };
  }

  try {
    return await requestMenuSettings(menuSettingsUrl, env.ORDER_WEBHOOK_SECRET, batchKey, useTestAvailability);
  } catch (error) {
    if (!env.ORDER_WEBHOOK_SECRET) throw error;

    // Products are intentionally public through doGet, so this keeps the menu visible
    // if a secret binding is temporarily unavailable during a deployment.
    return requestMenuSettings(menuSettingsUrl, undefined, batchKey, useTestAvailability);
  }
}

async function requestMenuSettings(menuSettingsUrl, secret, batchKey, useTestAvailability) {
  const url = new URL(menuSettingsUrl);
  if (batchKey) url.searchParams.set("batch", batchKey);
  if (useTestAvailability) url.searchParams.set("environment", "test");
  const response = await fetch(url.toString(), {
    method: secret ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(secret ? { "Content-Type": "application/json" } : {}),
    },
    body: secret
      ? JSON.stringify({ secret, action: "menuSettings", batch: batchKey, environment: useTestAvailability ? "test" : "" })
      : undefined,
  });
  const data = await response.json().catch(() => null);

  const snapshot = normalizeMenuSnapshot(data);
  if (!response.ok || data?.ok !== true || !snapshot) {
    throw new Error(`Menu settings returned ${response.status}`);
  }

  return snapshot;
}

async function getMenuSnapshot(env, batchKey) {
  if (!env.MENU_SNAPSHOT) return null;

  const bundle = await env.MENU_SNAPSHOT.get(MENU_SNAPSHOT_KEY, "json");
  if (bundle?.ok === true && bundle.snapshots && typeof bundle.snapshots === "object") {
    const resolvedBatchKey = resolveMenuBatchKey({
      requestedBatchKey: batchKey,
      publishedCurrentBatch: bundle.currentBatch,
      calendar: normalizeCalendar(bundle.calendar || Object.values(bundle.snapshots).flatMap((snapshot) => snapshot?.calendar || [])),
      availableSnapshotKeys: Object.keys(bundle.snapshots),
    });
    const normalized = normalizeMenuSnapshot(bundle.snapshots[resolvedBatchKey]);

    if (batchKey && normalized && !normalized.batchKey) return null;

    return normalized;
  }

  // Read the previous layout only until both Workers have received their first
  // bundled snapshot. This avoids a blank menu during the rollout.
  const legacyKey = batchKey ? `batch:${batchKey}` : LEGACY_MENU_SNAPSHOT_KEY;
  const snapshot = await env.MENU_SNAPSHOT.get(legacyKey, "json");
  if (!snapshot || snapshot.ok !== true) return null;

  const normalized = normalizeMenuSnapshot(snapshot);

  // Earlier snapshots stored products only. Do not let one override a Calendar
  // decision for a specific requested batch; refresh it from Apps Script once.
  if (batchKey && normalized && !normalized.batchKey) return null;

  return normalized;
}

async function saveMenuSnapshotBundle(env, snapshots, currentBatch) {
  if (!env.MENU_SNAPSHOT) return null;

  const normalizedSnapshots = Object.fromEntries(
    Object.entries(snapshots || {})
      .map(([batchKey, snapshot]) => [batchKey, normalizeMenuSnapshot(snapshot)])
      .filter(([, snapshot]) => Boolean(snapshot))
  );
  const batchKeys = Object.keys(normalizedSnapshots);
  if (batchKeys.length === 0) return null;

  const resolvedCurrentBatch = normalizedSnapshots[currentBatch] ? currentBatch : batchKeys[0];
  await env.MENU_SNAPSHOT.put(
    MENU_SNAPSHOT_KEY,
    JSON.stringify({
      ok: true,
      publishedAt: new Date().toISOString(),
      currentBatch: resolvedCurrentBatch,
      snapshots: normalizedSnapshots,
    })
  );

  return resolvedCurrentBatch;
}

function menuCacheKey(url, batchKey = "", suffix = "") {
  const cacheUrl = new URL(url);
  cacheUrl.pathname = `/__cache/${EDGE_CACHE_VERSION}${MENU_ENDPOINT}${suffix}`;
  cacheUrl.search = batchKey ? `?batch=${encodeURIComponent(batchKey)}` : "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function stockCacheKey(url, batchKey = "") {
  const cacheUrl = new URL(url);
  cacheUrl.pathname = `/__cache/${EDGE_CACHE_VERSION}${STOCK_ENDPOINT}`;
  cacheUrl.search = batchKey ? `?batch=${encodeURIComponent(batchKey)}` : "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function edgeMenuResponse(settings, maxAge = MENU_FALLBACK_CACHE_SECONDS) {
  return Response.json(settings, {
    headers: { "Cache-Control": `public, max-age=${maxAge}` },
  });
}

async function clearMenuEdgeCache(url, batchKeys = []) {
  const keys = new Set(["", ...batchKeys.filter(Boolean)]);

  await Promise.all(
    [...keys].flatMap((batchKey) => [
      caches.default.delete(menuCacheKey(url, batchKey)),
      caches.default.delete(menuCacheKey(url, batchKey, "/fallback")),
      caches.default.delete(stockCacheKey(url, batchKey)),
    ])
  );
}

async function getMenuSettings(request, env, ctx) {
  const batchKey = new URL(request.url).searchParams.get("batch") || "";
  // Read published inventory before any fallback cache. Cache API invalidation
  // only reaches the publishing location, not every customer location or host.
  const snapshot = await getMenuSnapshot(env, batchKey);
  if (snapshot) return snapshot;

  // Keep the site responsive until the KV binding has been seeded or during recovery.
  const fallbackCacheKey = menuCacheKey(request.url, batchKey, "/fallback");
  const fallbackCached = await caches.default.match(fallbackCacheKey);
  if (fallbackCached) return fallbackCached.json();

  const isTestWorker = new URL(request.url).hostname.startsWith("test-");
  const settings = await fetchMenuSettings(env, batchKey, isTestWorker);
  ctx.waitUntil(caches.default.put(fallbackCacheKey, edgeMenuResponse(settings)));
  return settings;
}

async function getStockSettings(request, env, ctx) {
  const requestUrl = new URL(request.url);
  const requestedBatchKey = requestUrl.searchParams.get("batch") || "";

  let menu = await getMenuSettings(request, env, ctx);

  // Older `current` snapshots can predate the kitchen checklist. Once we know
  // today's batch, read its batch-specific snapshot, which is published in the
  // same Apps Script sync and includes the ingredient calculations.
  if (!requestedBatchKey && (!menu.shopping?.generatedAt || menu.shopping.batchKey !== menu.batchKey) && menu.batchKey) {
    requestUrl.searchParams.set("batch", menu.batchKey);
    menu = await getMenuSettings(new Request(requestUrl.toString(), request), env, ctx);
  }

  if (!menu.shopping?.generatedAt || menu.shopping.batchKey !== menu.batchKey) {
    return jsonResponse(
      { ok: false, error: "Stock checklist has not been published for this bake yet." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  return jsonResponse({
    ok: true,
    batchKey: menu.batchKey,
    shopping: menu.shopping,
  });
}

async function verifyTurnstile(token, secret, remoteIp, idempotencyKey) {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  if (idempotencyKey) body.set("idempotency_key", idempotencyKey);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const result = await response.json().catch(() => null);
  return result?.success === true && result.action === "order";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === MENU_ENDPOINT) {
      if (request.method !== "GET") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
      }

      try {
        return jsonResponse(await getMenuSettings(request, env, ctx));
      } catch (error) {
        console.error("Unable to load menu settings", error);
        ctx.waitUntil(recordOperationalFailure(env, "menuRead", "Production menu could not be loaded"));
        return jsonResponse(
          { ok: false, error: "Menu settings are temporarily unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    if (url.pathname === STOCK_ENDPOINT) {
      if (request.method !== "GET") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
      }

      // The phone-first stock list is deliberately a private test feature until
      // Cloudflare Access is configured for Jia's account.
      if (!url.hostname.startsWith("test-")) {
        return jsonResponse({ ok: false, error: "Not found" }, { status: 404 });
      }

      try {
        return await getStockSettings(request, env, ctx);
      } catch (error) {
        console.error("Unable to load stock settings", error);
        return jsonResponse({ ok: false, error: "Stock list is temporarily unavailable" }, { status: 503 });
      }
    }

    if (url.pathname === MENU_SYNC_ENDPOINT) {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        return jsonResponse({ ok: false, error: "Invalid menu snapshot" }, { status: 400 });
      }

      if (
        !env.ORDER_WEBHOOK_SECRET ||
        payload?.secret !== env.ORDER_WEBHOOK_SECRET ||
        !Array.isArray(payload.products) && !payload?.snapshots
      ) {
        return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      if (!env.MENU_SNAPSHOT) {
        return jsonResponse({ ok: false, error: "Menu snapshot storage is not configured" }, { status: 503 });
      }

      if (payload?.snapshots && typeof payload.snapshots === "object") {
        const currentBatch = await saveMenuSnapshotBundle(
          env,
          payload.snapshots,
          payload.currentBatch
        );
        if (!currentBatch) {
          return jsonResponse({ ok: false, error: "Invalid menu snapshots" }, { status: 400 });
        }
        await clearMenuEdgeCache(request.url, Object.keys(payload.snapshots));
      } else {
        const snapshot = normalizeMenuSnapshot(payload.products);
        const batchKey = snapshot?.batchKey || "current";
        await saveMenuSnapshotBundle(env, { [batchKey]: snapshot }, batchKey);
        await clearMenuEdgeCache(request.url);
      }
      return jsonResponse({ ok: true });
    }

    if (url.pathname === MONITOR_ENDPOINT) {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
      }

      let payload;
      try {
        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > 2_000) {
          return jsonResponse({ ok: false, error: "Request is too large" }, { status: 413 });
        }
        const body = await request.arrayBuffer();
        if (body.byteLength > 2_000) {
          return jsonResponse({ ok: false, error: "Request is too large" }, { status: 413 });
        }
        payload = JSON.parse(new TextDecoder().decode(body));
      } catch {
        return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
      if (!env.ORDER_WEBHOOK_SECRET || payload?.secret !== env.ORDER_WEBHOOK_SECRET) {
        return jsonResponse({ ok: false, error: "Unauthorized" }, { status: 401 });
      }

      const [monitorState, menuBundle] = env.MENU_SNAPSHOT
        ? await Promise.all([
          env.MENU_SNAPSHOT.get(MONITOR_STATE_KEY, "json"),
          env.MENU_SNAPSHOT.get(MENU_SNAPSHOT_KEY, "json"),
        ])
        : [null, null];
      return jsonResponse({
        ok: true,
        events: monitorState?.events || {},
        menuPublishedAt: menuBundle?.publishedAt || "",
        currentBatch: menuBundle?.currentBatch || "",
      });
    }

    if (url.pathname !== ORDER_ENDPOINT) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    // Preview deployments may share the production bindings, so never let them create real orders.
    if (url.hostname !== "swirlgirl.sg") {
      return jsonResponse({ ok: false, error: "Orders are disabled on this preview site" }, { status: 403 });
    }

    const origin = request.headers.get("Origin");
    if (origin !== url.origin) {
      return jsonResponse({ ok: false, error: "Invalid origin" }, { status: 403 });
    }

    if (!env.ORDER_SHEET_WEBHOOK_URL || !env.ORDER_WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "Order service is not configured" }, { status: 503 });
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_ORDER_BYTES) {
      return jsonResponse({ ok: false, error: "Order is too large" }, { status: 413 });
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, { status: 415 });
    }

    let payload;
    let sheetResult;
    try {
      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_ORDER_BYTES) {
        return jsonResponse({ ok: false, error: "Order is too large" }, { status: 413 });
      }
      payload = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return jsonResponse({ ok: false, error: "Invalid order" }, { status: 400 });
    }

    const normalized = normalizeOrderRequest(payload);
    if (normalized.error) {
      return jsonResponse({ ok: false, error: normalized.error }, { status: 400 });
    }
    const requestFingerprint = await orderFingerprint(normalized.order);

    let menu;
    try {
      const menuUrl = new URL(request.url);
      menuUrl.pathname = MENU_ENDPOINT;
      menuUrl.search = `?batch=${encodeURIComponent(normalized.order.bakeWindow)}`;
      menu = await getMenuSettings(new Request(menuUrl.toString()), env, ctx);
    } catch (error) {
      console.error("Unable to validate order menu", error);
      ctx.waitUntil(recordOperationalFailure(env, "orderMenuValidation", "Order menu validation was unavailable"));
      return jsonResponse({ ok: false, error: "Unable to validate the current menu" }, { status: 503 });
    }
    const menuValidation = validateOrderAgainstMenu(normalized.order, menu);

    if (env.TURNSTILE_SECRET_KEY) {
      const isTurnstileValid =
        typeof payload.turnstileToken === "string" &&
        (await verifyTurnstile(
          payload.turnstileToken,
          env.TURNSTILE_SECRET_KEY,
          request.headers.get("CF-Connecting-IP"),
          normalized.requestId
        ));

      if (!isTurnstileValid) {
        return jsonResponse({ ok: false, error: "Security check failed" }, { status: 403 });
      }
    }

    try {
      const sheetResponse = await fetch(env.ORDER_SHEET_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.ORDER_WEBHOOK_SECRET,
          requestId: normalized.requestId,
          requestFingerprint,
          // Apps Script repeats the menu checks under its write lock. Sending
          // the normalized source order when the KV view is stale lets a
          // legitimate replay reach the durable duplicate check first.
          order: menuValidation.order || normalized.order,
        }),
      });

      sheetResult = await sheetResponse.json().catch(() => null);
      if (!sheetResponse.ok || sheetResult?.ok !== true) {
        if (sheetResult?.errorCode === "REQUEST_ID_CONFLICT") {
          return jsonResponse({ ok: false, error: "This request ID was already used for different order details" }, { status: 409 });
        }
        if (["INVALID_ORDER", "ORDER_UNAVAILABLE", "PRICE_CHANGED"].includes(sheetResult?.errorCode)) {
          return jsonResponse(
            { ok: false, error: sheetResult.error || "The order is no longer available" },
            { status: sheetResult.errorCode === "INVALID_ORDER" ? 400 : 409 }
          );
        }
        throw new Error(`Google Apps Script returned ${sheetResponse.status}`);
      }
    } catch (error) {
      console.error("Unable to save order request", error);
      ctx.waitUntil(recordOperationalFailure(env, "orderRelay", "An order could not be relayed to Apps Script"));
      return jsonResponse({ ok: false, error: "Unable to save order" }, { status: 502 });
    }

    if (sheetResult.menuRefreshDeferred === true) ctx.waitUntil(
      fetch(env.ORDER_SHEET_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: env.ORDER_WEBHOOK_SECRET, action: "refreshMenuAfterOrder" }),
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || result?.ok !== true) throw new Error("Menu refresh failed");
        console.log("Post-order menu refresh completed");
      }).catch(() => {
        console.error("Post-order menu refresh incomplete; scheduled Apps Script refresh remains available");
        return recordOperationalFailure(env, "postOrderRefresh", "Post-order menu refresh did not complete");
      })
    );
    return jsonResponse({
      ok: true,
      orderNumber: sheetResult?.orderNumber || "",
      duplicate: sheetResult?.duplicate === true,
    });
  },
};
