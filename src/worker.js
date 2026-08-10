const ORDER_ENDPOINT = "/api/orders";
const MENU_ENDPOINT = "/api/menu";
const MENU_SYNC_ENDPOINT = "/api/menu/sync";
const MENU_SNAPSHOT_KEY = "current";
const MAX_ORDER_BYTES = 16_000;
const MENU_FALLBACK_CACHE_SECONDS = 300;

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

function normalizeMenuSnapshot(snapshot) {
  const source = Array.isArray(snapshot) ? { products: snapshot } : snapshot;
  if (!source || !Array.isArray(source.products)) return null;

  return {
    ok: true,
    batchKey: typeof source.batchKey === "string" ? source.batchKey : "",
    defaultBatch: typeof source.defaultBatch === "string" ? source.defaultBatch : "",
    calendar: normalizeCalendar(source.calendar),
    products: source.products.map(normalizeMenuProduct).filter(Boolean),
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

  const key = batchKey ? `batch:${batchKey}` : MENU_SNAPSHOT_KEY;
  const snapshot = await env.MENU_SNAPSHOT.get(key, "json");
  if (!snapshot || snapshot.ok !== true) return null;

  const normalized = normalizeMenuSnapshot(snapshot);

  // Earlier snapshots stored products only. Do not let one override a Calendar
  // decision for a specific requested batch; refresh it from Apps Script once.
  if (batchKey && normalized && !normalized.batchKey) return null;

  return normalized;
}

async function saveMenuSnapshot(env, snapshot, batchKey) {
  if (!env.MENU_SNAPSHOT) return;

  const normalized = normalizeMenuSnapshot(snapshot);
  if (!normalized) return;

  await env.MENU_SNAPSHOT.put(batchKey ? `batch:${batchKey}` : MENU_SNAPSHOT_KEY, JSON.stringify(normalized));
}

async function removeStaleBatchSnapshots(env, activeBatchKeys) {
  if (!env.MENU_SNAPSHOT) return;

  const activeKeys = new Set(Object.keys(activeBatchKeys).map((batchKey) => `batch:${batchKey}`));
  let cursor;

  do {
    const page = await env.MENU_SNAPSHOT.list({ prefix: "batch:", cursor });
    await Promise.all(
      page.keys
        .filter((entry) => !activeKeys.has(entry.name))
        .map((entry) => env.MENU_SNAPSHOT.delete(entry.name))
    );
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

function fallbackMenuCacheKey(url) {
  const cacheUrl = new URL(url);
  cacheUrl.pathname = `${MENU_ENDPOINT}/fallback`;
  return new Request(cacheUrl.toString(), { method: "GET" });
}

async function getMenuSettings(request, env, ctx) {
  const batchKey = new URL(request.url).searchParams.get("batch") || "";
  const snapshot = await getMenuSnapshot(env, batchKey);
  if (snapshot) return snapshot;

  // Keep the site responsive until the KV binding has been seeded or during recovery.
  const cacheKey = fallbackMenuCacheKey(request.url);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached.json();

  const isTestWorker = new URL(request.url).hostname.startsWith("test-");
  const settings = await fetchMenuSettings(env, batchKey, isTestWorker);
  const cacheResponse = Response.json(settings, {
    headers: { "Cache-Control": `public, max-age=${MENU_FALLBACK_CACHE_SECONDS}` },
  });
  ctx.waitUntil(
    Promise.all([caches.default.put(cacheKey, cacheResponse), saveMenuSnapshot(env, settings, batchKey)])
  );
  return settings;
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
        await Promise.all(
          Object.entries(payload.snapshots).map(([batchKey, snapshot]) =>
            saveMenuSnapshot(env, snapshot, batchKey)
          )
        );
        await removeStaleBatchSnapshots(env, payload.snapshots);
        const currentSnapshot = payload.snapshots[payload.currentBatch] || { products: [] };
        await saveMenuSnapshot(env, currentSnapshot);
      } else {
        await saveMenuSnapshot(env, payload.products);
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
