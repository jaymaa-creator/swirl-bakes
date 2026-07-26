const ORDER_ENDPOINT = "/api/orders";
const MAX_ORDER_BYTES = 16_000;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid order" }, { status: 400 });
    }

    if (!isValidOrder(payload.order)) {
      return jsonResponse({ ok: false, error: "Incomplete order" }, { status: 400 });
    }

    try {
      const sheetResponse = await fetch(env.ORDER_SHEET_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: env.ORDER_WEBHOOK_SECRET, order: payload.order }),
      });

      const sheetResult = await sheetResponse.json().catch(() => null);
      if (!sheetResponse.ok || sheetResult?.ok !== true) {
        throw new Error(`Google Apps Script returned ${sheetResponse.status}`);
      }
    } catch (error) {
      console.error("Unable to save order request", error);
      return jsonResponse({ ok: false, error: "Unable to save order" }, { status: 502 });
    }

    return jsonResponse({ ok: true });
  },
};
