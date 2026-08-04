const ORDER_ENDPOINT = "/api/orders";
const MENU_ENDPOINT = "/api/menu";
const MAX_ORDER_BYTES = 16_000;
const MENU_CURRENT_CACHE_SECONDS = 15;
const MENU_LAST_KNOWN_CACHE_SECONDS = 31_536_000;

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

  return {
    id: product.id.trim(),
    priceSgd: Number(product.priceSgd) || undefined,
    available: product.available,
    batchLimit: Number(product.batchLimit) || undefined,
    maxQuantity: Number(product.maxQuantity) || undefined,
    description: typeof product.description === "string" ? product.description.trim() : undefined,
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl.trim() : undefined,
    allergens: typeof product.allergens === "string" ? product.allergens.trim() : undefined,
    remainingQuantity:
      Number(product.remainingQuantity) >= 0 ? Number(product.remainingQuantity) : undefined,
    soldQuantity: Number(product.soldQuantity) >= 0 ? Number(product.soldQuantity) : undefined,
  };
}

async function fetchMenuSettings(env) {
  const menuSettingsUrl = env.MENU_SETTINGS_URL || env.ORDER_SHEET_WEBHOOK_URL;

  if (!menuSettingsUrl) {
    return { ok: true, products: [] };
  }

  try {
    return await requestMenuSettings(menuSettingsUrl, env.ORDER_WEBHOOK_SECRET);
  } catch (error) {
    if (!env.ORDER_WEBHOOK_SECRET) throw error;

    // Products are intentionally public through doGet, so this keeps the menu visible
    // if a secret binding is temporarily unavailable during a deployment.
    return requestMenuSettings(menuSettingsUrl);
  }
}

async function requestMenuSettings(menuSettingsUrl, secret, action = "menuSettings") {
  const response = await fetch(menuSettingsUrl, {
    method: secret ? "POST" : "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(secret ? { "Content-Type": "application/json" } : {}),
    },
    body: secret ? JSON.stringify({ secret, action }) : undefined,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok !== true || !Array.isArray(data.products)) {
    throw new Error(`Menu settings returned ${response.status}`);
  }

  return {
    ok: true,
    products: data.products.map(normalizeMenuProduct).filter(Boolean),
  };
}

function menuCacheKey(url, segment) {
  const cacheUrl = new URL(url);
  cacheUrl.pathname = `${MENU_ENDPOINT}/${segment}`;
  cacheUrl.search = "";
  return new Request(cacheUrl.toString(), { method: "GET" });
}

async function refreshMenuSnapshot(request, env, cache) {
  const settings = await fetchMenuSettings(env);
  const currentKey = menuCacheKey(request.url, "current");
  const lastKnownKey = menuCacheKey(request.url, "last-known");
  const currentResponse = Response.json(settings, {
    headers: { "Cache-Control": `public, max-age=${MENU_CURRENT_CACHE_SECONDS}` },
  });
  const lastKnownResponse = Response.json(settings, {
    headers: { "Cache-Control": `public, max-age=${MENU_LAST_KNOWN_CACHE_SECONDS}` },
  });

  await Promise.all([
    cache.put(currentKey, currentResponse),
    cache.put(lastKnownKey, lastKnownResponse),
  ]);
  return settings;
}

async function getMenuSettings(request, env, ctx) {
  const cache = caches.default;
  const current = await cache.match(menuCacheKey(request.url, "current"));
  if (current) return current.json();

  const lastKnown = await cache.match(menuCacheKey(request.url, "last-known"));
  if (lastKnown) {
    // Never make customers wait for Apps Script once we have a valid menu snapshot.
    ctx.waitUntil(refreshMenuSnapshot(request, env, cache));
    return lastKnown.json();
  }

  // Only the very first request in a Cloudflare location waits for Apps Script.
  return refreshMenuSnapshot(request, env, cache);
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
        // A short cache gives fast page loads while keeping spreadsheet edits near-instant.
        return jsonResponse(await getMenuSettings(request, env, ctx), {
          headers: { "Cache-Control": "no-store" },
        });
      } catch (error) {
        console.error("Unable to load menu settings", error);
        return jsonResponse(
          { ok: false, error: "Menu settings are temporarily unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    if (url.pathname !== ORDER_ENDPOINT) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
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

    ctx.waitUntil(caches.default.delete(menuCacheKey(request.url, "current")));
    ctx.waitUntil(refreshMenuSnapshot(request, env, caches.default));
    return jsonResponse({ ok: true, orderNumber: sheetResult?.orderNumber || "" });
  },
};
