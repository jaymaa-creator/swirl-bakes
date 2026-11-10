// Worker-only signing and resolution. Never expose either environment secret.
import { amountToCents, createPaynowPayload, PAYNOW_TEST_HOST, PAYNOW_PRODUCTION_HOST } from "./lib/paynow.js";

const LIFETIME = 7 * 24 * 60 * 60;
const SHORT_LINK = /^s\.[A-Za-z0-9_-]{22}$/;
const MAX_TOKEN_LENGTH = 16384;
const MAX_BODY_BYTES = 20000;
const encoder = new TextEncoder();
const reply = (body, status = 200) => Response.json(body, { status, headers: {
  "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
} });
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
const signingKey = (secret) => crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const withoutControls = value => Array.from(value, char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char).join("");

export function validPaymentItems(items) {
  return Array.isArray(items) && items.length >= 1 && items.length <= 21 && items.every(item =>
    typeof item?.name === "string" && item.name.trim().length > 0 && item.name.length <= 80
    && withoutControls(item.name) === item.name
    && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 100);
}

// Called only after the normal Worker and locked backend accepted this order.
// Names come from the environment menu; the browser's free-text item summary is ignored.
export function paymentItemsForOrder(order, snapshot) {
  if (!Array.isArray(order?.lineItems) || order.lineItems.length < 1 || order.lineItems.length > 20) return null;
  const products = new Map((snapshot?.products || []).map(product => [product.id, product]));
  const items = order.lineItems.map(line => {
    const id = typeof line.productId === "string" ? line.productId.trim() : "";
    const product = products.get(id);
    const name = typeof product?.productName === "string" && product.productName.trim() ? product.productName : id;
    const per = typeof product?.per === "string" ? product.per.trim().replace(/^per\s+/i, "") : "";
    return { name: withoutControls(per ? `${name} (${per})` : name).trim().slice(0, 80), quantity: Number(line.quantity) };
  });
  if (order.bananaChocolateChips === true) items.push({ name: "Chocolate chips for Banana Cake", quantity: Number(order.lineItems.find(line => line.productId.trim() === "banana-bread")?.quantity) });
  return validPaymentItems(items) ? items : null;
}

// Explicit instances keep test's existing signed links compatible.
function createPaymentService(testMode) {
  const host = testMode ? PAYNOW_TEST_HOST : PAYNOW_PRODUCTION_HOST;
  const origins = testMode ? [`https://${host}`] : [`https://${host}`, `https://www.${host}`];
  const purpose = testMode ? "swirl-test-paynow-v1:" : "swirl-production-paynow-v1:";
  const prefix = testMode ? "isolated-test:paynow-link-v1:" : "production:paynow-link-v1:";
  const secretFor = env => testMode ? env.TEST_ORDER_WEBHOOK_SECRET : env.ORDER_WEBHOOK_SECRET;
  const validOrder = value => typeof value === "string" && (testMode ? /^TEST-[A-Za-z0-9-]{1,75}$/ : /^SG-[A-Za-z0-9-]{1,75}$/).test(value);

  async function paymentDetails(claims, token) {
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(claims.orderNumber)));
    const reference = (testMode ? "T" : "P") + Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24).toUpperCase();
    const amountDueSgd = claims.cents / 100;
    return { orderNumber: claims.orderNumber, amountDueSgd, reference, expiresAt: claims.exp,
      ...(claims.v === 2 ? { items: claims.items } : {}),
      url: `https://${host}/pay#${token}`, payload: createPaynowPayload(amountDueSgd, reference) };
  }

  async function issue(result, secret, now = Math.floor(Date.now() / 1000), items) {
    const cents = amountToCents(result?.amountDueSgd);
    if (!secret || result?.ok !== true || !validOrder(result.orderNumber) || cents === null) return null;
    if (items !== undefined && !validPaymentItems(items)) return null;
    const claims = { v: items ? 2 : 1, orderNumber: result.orderNumber, cents, iat: now, exp: now + LIFETIME,
      ...(items ? { items: items.map(({ name, quantity }) => ({ name, quantity })) } : {}) };
    const body = encode(encoder.encode(JSON.stringify(claims)));
    const signature = encode(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(purpose + body))));
    return paymentDetails(claims, `${body}.${signature}`);
  }

  // A random 128-bit reference keeps order details out of the shared URL.
  // Await persistence before offering the link; keep the signed record immutable.
  async function issueShort(result, env, now = Math.floor(Date.now() / 1000), items) {
    const payment = await issue(result, secretFor(env), now, items);
    if (!payment || !env.MENU_SNAPSHOT?.put) return null;
    const id = encode(crypto.getRandomValues(new Uint8Array(16)));
    await env.MENU_SNAPSHOT.put(prefix + id, new URL(payment.url).hash.slice(1), { expiration: payment.expiresAt });
    return { ...payment, url: `https://${host}/pay#s.${id}` };
  }

  async function resolve(token, secret, now = Math.floor(Date.now() / 1000)) {
    if (!secret || typeof token !== "string" || token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
    try {
      const [body, signature] = token.split(".");
      if (encode(decode(signature)) !== signature || !await crypto.subtle.verify("HMAC", await signingKey(secret), decode(signature), encoder.encode(purpose + body))) return null;
      const claims = JSON.parse(new TextDecoder().decode(decode(body)));
      if (![1, 2].includes(claims.v) || (claims.v === 2 && !validPaymentItems(claims.items))
          || (claims.v === 1 && claims.items !== undefined)
          || !validOrder(claims.orderNumber) || !Number.isSafeInteger(claims.cents)
          || claims.cents < 1 || claims.cents > 99999999 || !Number.isSafeInteger(claims.iat)
          || !Number.isSafeInteger(claims.exp) || claims.iat > now || claims.exp <= now
          || claims.exp - claims.iat !== LIFETIME) return null;
      return paymentDetails(claims, token);
    } catch { return null; }
  }

  async function handle(request, env) {
    const origin = new URL(request.url).origin;
    if (!origins.includes(origin)) return reply({ error: "Payment host only" }, 403);
    if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
    if (request.headers.get("Origin") !== origin) return reply({ error: "Invalid origin" }, 403);
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return reply({ error: "JSON required" }, 415);
    if (!secretFor(env)) return reply({ error: "Payment details are temporarily unavailable. Please contact us on WhatsApp." }, 503);
    if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) return reply({ error: "Request too large" }, 413);
    // Bound streamed bodies as well as Content-Length before parsing.
    let size = 0;
    const chunks = [];
    if (request.body) {
      const reader = request.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) { await reader.cancel(); return reply({ error: "Request too large" }, 413); }
        chunks.push(value);
      }
    }
    try {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const { token } = JSON.parse(new TextDecoder().decode(bytes));
      let signedToken = token;
      const short = typeof token === "string" && SHORT_LINK.test(token);
      if (short) {
        try { signedToken = await env.MENU_SNAPSHOT.get(prefix + token.slice(2)); }
        catch { return reply({ error: "Payment details are temporarily unavailable. Please try again." }, 503); }
        // KV can briefly lag in another location. Retrying reads never resubmits an order.
        if (!signedToken) return reply({ error: "This payment link is not available yet or has expired. If you just placed the order, wait a minute and try again." }, 404);
      }
      const paynow = await resolve(signedToken, secretFor(env));
      if (paynow && short) paynow.url = `https://${host}/pay#${token}`;
      return paynow ? reply({ ok: true, paynow }) : reply({ error: "This payment link is invalid or has expired. Please ask us on WhatsApp to check your order." }, 400);
    } catch { return reply({ error: "Invalid payment link" }, 400); }
  }

  return { issue, issueShort, resolve, handle };
}

export const testPayments = createPaymentService(true);
export const productionPayments = createPaymentService(false);
