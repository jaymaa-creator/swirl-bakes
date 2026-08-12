const ORDER_ENDPOINT = "/api/orders";
const MENU_ENDPOINT = "/api/menu";
const MENU_SYNC_ENDPOINT = "/api/menu/sync";
const STOCK_ENDPOINT = "/api/stock";
// Keep every published batch in one value. A full sheet sync therefore costs one
// KV write per environment instead of a write (and cleanup) for every batch.
const MENU_SNAPSHOT_KEY = "menu-snapshots-v1";
const LEGACY_MENU_SNAPSHOT_KEY = "current";
const MAX_ORDER_BYTES = 16_000;
const MENU_FALLBACK_CACHE_SECONDS = 300;
const MENU_EDGE_CACHE_SECONDS = 900;

function jsonResponse(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

function isValidOrder(order) {
  return (
    order &&
    typeof order.name === "string" &&
    typeof order.phone === "string" &&
    typeof order.items === "string" &&
    order.items.length > 0
  );
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
    priceSgd: finiteNumber(product.priceSgd),
    available: product.available,
    special: product.special === true,
    batchLimit: finiteNumber(product.batchLimit),
    maxQuantity: finiteNumber(product.maxQuantity),
    description: typeof product.description === "string" ? product.description.trim() : undefined,
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl.trim() : undefined,
    allergens: typeof product.allergens === "string" ? product.allergens.trim() : undefined,
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
    const resolvedBatchKey = batchKey || bundle.currentBatch;
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
      currentBatch: resolvedCurrentBatch,
      snapshots: normalizedSnapshots,
    })
  );

  return resolvedCurrentBatch;
}

function menuCacheKey(url, batchKey = "", suffix = "") {
  const cacheUrl = new URL(url);
  cacheUrl.pathname = `${MENU_ENDPOINT}${suffix}`;
  cacheUrl.search = batchKey ? `?batch=${encodeURIComponent(batchKey)}` : "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function stockCacheKey(url, batchKey = "") {
  const cacheUrl = new URL(url);
  cacheUrl.pathname = STOCK_ENDPOINT;
  cacheUrl.search = batchKey ? `?batch=${encodeURIComponent(batchKey)}` : "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function edgeMenuResponse(settings, maxAge = MENU_EDGE_CACHE_SECONDS) {
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
  const edgeCacheKey = menuCacheKey(request.url, batchKey);

  // Cloudflare's Cache API is much cheaper than a KV read. The sheet sync deletes
  // this entry as soon as it publishes a replacement snapshot.
  const cached = await caches.default.match(edgeCacheKey);
  if (cached) return cached.json();

  const snapshot = await getMenuSnapshot(env, batchKey);
  if (snapshot) {
    ctx.waitUntil(caches.default.put(edgeCacheKey, edgeMenuResponse(snapshot)));
    return snapshot;
  }

  // Keep the site responsive until the KV binding has been seeded or during recovery.
  const fallbackCacheKey = menuCacheKey(request.url, batchKey, "/fallback");
  const fallbackCached = await caches.default.match(fallbackCacheKey);
  if (fallbackCached) return fallbackCached.json();

  const isTestWorker = new URL(request.url).hostname.startsWith("test-");
  const settings = await fetchMenuSettings(env, batchKey, isTestWorker);
  ctx.waitUntil(
    Promise.all([
      caches.default.put(fallbackCacheKey, edgeMenuResponse(settings, MENU_FALLBACK_CACHE_SECONDS)),
      caches.default.put(edgeCacheKey, edgeMenuResponse(settings)),
    ])
  );
  return settings;
}

async function getStockSettings(request, env, ctx) {
  const requestUrl = new URL(request.url);
  const requestedBatchKey = requestUrl.searchParams.get("batch") || "";
  const edgeCacheKey = stockCacheKey(request.url, requestedBatchKey);
  const cached = await caches.default.match(edgeCacheKey);
  if (cached) return cached;

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

  const response = edgeMenuResponse({
    ok: true,
    batchKey: menu.batchKey,
    shopping: menu.shopping,
  });
  ctx.waitUntil(caches.default.put(edgeCacheKey, response.clone()));
  return response;
}

async function verifyTurnstile(token, secret, remoteIp) {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
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

    let payload;
    let sheetResult;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid order" }, { status: 400 });
    }

    if (!isValidOrder(payload.order)) {
      return jsonResponse({ ok: false, error: "Incomplete order" }, { status: 400 });
    }

    if (env.TURNSTILE_SECRET_KEY) {
      const isTurnstileValid =
        typeof payload.turnstileToken === "string" &&
        (await verifyTurnstile(
          payload.turnstileToken,
          env.TURNSTILE_SECRET_KEY,
          request.headers.get("CF-Connecting-IP")
        ));

      if (!isTurnstileValid) {
        return jsonResponse({ ok: false, error: "Security check failed" }, { status: 403 });
      }
    }

    try {
      const sheetResponse = await fetch(env.ORDER_SHEET_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: env.ORDER_WEBHOOK_SECRET, order: payload.order }),
      });

      sheetResult = await sheetResponse.json().catch(() => null);
      if (!sheetResponse.ok || sheetResult?.ok !== true) {
        throw new Error(`Google Apps Script returned ${sheetResponse.status}`);
      }
    } catch (error) {
      console.error("Unable to save order request", error);
      return jsonResponse({ ok: false, error: "Unable to save order" }, { status: 502 });
    }

    return jsonResponse({ ok: true, orderNumber: sheetResult?.orderNumber || "" });
  },
};
