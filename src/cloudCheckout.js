// Environment selection is supplied by the two dedicated Worker entry points.
import { normalizeOrderRequest, orderFingerprint, validateOrderAgainstMenu, verifyTurnstile } from "./worker.js";
import { getCurrentBatchKey } from "./lib/batchSelection.js";
import { productionPayments, testPayments, paymentItemsForOrder } from "./paynowPayments.js";
import { COLLECTION_OPTION } from "./config/orderPolicy.js";

const payments = env => env.productionCheckout ? productionPayments : testPayments;
const secret = env => env.productionCheckout ? env.ORDER_WEBHOOK_SECRET : env.TEST_ORDER_WEBHOOK_SECRET;
const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const unavailable = () => reply({ ok: false, error: "Checkout is refreshing. Please try again." }, 503);
const bind = (db, sql, ...args) => db.prepare(sql).bind(...args);

export async function publishCheckout(db, snapshot) {
  if (
    !snapshot?.bundle?.snapshots?.[snapshot.bundle.currentBatch] ||
    !Number.isSafeInteger(snapshot.captured) ||
    !snapshot.existing ||
    !snapshot.seen ||
    !snapshot.customers ||
    !Array.isArray(snapshot.credits)
  )
    throw Error("Invalid checkout snapshot");
  // Clear an overlay only when the *same* published snapshot accounts for its ledger row.
  // A delayed publisher cannot acknowledge reservations against a newer inventory view.
  await db.batch([
    bind(
      db,
      "UPDATE checkout_baseline SET revision=revision+1,captured=?,snapshot=? WHERE id=1 AND captured<?",
      snapshot.captured,
      JSON.stringify(snapshot),
      snapshot.captured,
    ),
    bind(
      db,
      `UPDATE checkout_orders SET reserved=NULL,ledger_row=NULL,delivered=1 WHERE reserved IS NOT NULL
      AND (SELECT captured FROM checkout_baseline WHERE id=1)=?
      AND EXISTS (SELECT 1 FROM json_each(?) j WHERE j.key=checkout_orders.request_id
        AND json_extract(j.value,'$.fingerprint')=checkout_orders.fingerprint
        AND json_extract(j.value,'$.orderNumber')=json_extract(checkout_orders.receipt,'$.orderNumber'))`,
      snapshot.captured,
      JSON.stringify(snapshot.existing),
    ),
  ]);
}

async function readState(db, id, menuOnly = false, production = false) {
  const projection = menuOnly ? "json_object('bundle',json_extract(snapshot,'$.bundle'))" : "snapshot";
  const queries = [
    db.prepare(
      `SELECT revision, ${production ? "(SELECT last_number FROM checkout_sequence WHERE id=1) AS lastNumber," : ""} CASE WHEN captured>0 THEN ${projection} END AS snapshot FROM checkout_baseline WHERE id=1`,
    ),
    db.prepare("SELECT reserved FROM checkout_orders WHERE reserved IS NOT NULL ORDER BY created"),
  ];
  if (id) queries.push(bind(db, "SELECT fingerprint,receipt FROM checkout_orders WHERE request_id=?", id));
  const [base, pending, previous] = await db.batch(queries);
  const row = base.results[0];
  return {
    revision: row.revision,
    lastNumber: row.lastNumber,
    snapshot: JSON.parse(row.snapshot),
    pending: pending.results.map((r) => JSON.parse(r.reserved)),
    previous: previous?.results[0],
  };
}

function overlay(state) {
  const snapshot = state.snapshot;
  const used = new Set();
  for (const hold of state.pending) {
    if (snapshot.customers) {
      snapshot.customers[hold.customerKey] = hold.referralCode;
      snapshot.seen[hold.customerKey] = true;
    }
    if (hold.credit) used.add(hold.credit);
    for (const menu of Object.values(snapshot.bundle.snapshots)) {
      for (const product of menu.products) {
        if (product.kind !== "merch" && menu.batchKey !== hold.batch) continue;
        const quantity = Object.hasOwn(hold.items, product.id) ? hold.items[product.id] : 0;
        if (product.remainingQuantity != null)
          product.remainingQuantity = Math.max(0, product.remainingQuantity - quantity);
        product.soldQuantity = Number(product.soldQuantity || 0) + quantity;
      }
    }
  }
  if (snapshot.credits) snapshot.credits = snapshot.credits.filter((c) => !used.has(c.id));
  return snapshot;
}

export async function checkoutMenu(db) {
  const state = await readState(db, undefined, true);
  return state.snapshot ? overlay(state).bundle : null;
}

export async function relay(env, action, fields = {}, endpoint = env.productionCheckout ? env.ORDER_SHEET_WEBHOOK_URL : env.TEST_APPS_SCRIPT_URL) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, environment: env.productionCheckout ? "production" : "test", secret: secret(env), ...fields }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw Error("Checkout ledger unavailable");
  const result = await res.json();
  if (!result.ok) throw Error("Checkout ledger refused request");
  return result;
}

export async function refreshCheckout(env) {
  const result = await relay(env, "checkoutBootstrap");
  if (
    result.scriptId !== (env.productionCheckout ? "1YfNLgt5YZnDv8CwcR9zcGICM4v0jjfMCs9lzD_pWVh5M8O5Yc5xMVnhf" : "1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9") ||
    result.spreadsheetId !== (env.productionCheckout ? "12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A" : "1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc")
  )
    throw Error("Checkout ledger identity mismatch");
  if (env.productionCheckout && (!result.checkout?.writerActive || !Number.isSafeInteger(result.checkout.sequence))) throw Error("Production writer not active");
  await publishCheckout(env.PAYMENT_ORDERS, result.checkout);
}

export async function flushCheckout(env) {
  const db = env.PAYMENT_ORDERS;
  const now = Date.now();
  // Claim a bounded batch. A crashed or timed-out delivery becomes eligible again
  // without another customer visit. The Sheet checks the original request ID.
  const rows = await bind(
    db,
    `UPDATE checkout_orders SET retry_after=? WHERE request_id IN (
    SELECT request_id FROM checkout_orders WHERE delivered=0 AND retry_after<=?
    ORDER BY retry_after,created LIMIT 3) RETURNING request_id,ledger_row`,
    now + 300000,
    now,
  ).all();
  for (const row of rows.results) {
    try {
      const entry = JSON.parse(row.ledger_row);
      const ack = await relay(env, "appendCloudOrder", { entry });
      if (ack.requestId !== row.request_id || ack.orderNumber !== entry.orderNumber)
        throw Error("Checkout ledger acknowledgement mismatch");
      await bind(
        db,
        "UPDATE checkout_orders SET delivered=1,ledger_row=NULL WHERE request_id=?",
        row.request_id,
      ).run();
    } catch {
      console.error("Checkout ledger delivery pending; scheduled retry will follow");
    }
  }
  // A failed refresh is retried even when every ledger append already succeeded.
  const remaining = await db
    .prepare("SELECT 1 AS awaiting FROM checkout_orders WHERE reserved IS NOT NULL AND delivered=1 LIMIT 1")
    .first();
  if (remaining || !(await db.prepare("SELECT captured FROM checkout_baseline WHERE id=1").first())?.captured)
    await refreshCheckout(env);
}

function replay(row, fingerprint) {
  return row.fingerprint === fingerprint
    ? reply({ ...JSON.parse(row.receipt), duplicate: true })
    : reply({ ok: false, error: "This request ID was already used for different order details" }, 409);
}

async function accept(env, ctx, normalized, fingerprint) {
  const db = env.PAYMENT_ORDERS;
  const { requestId, order } = normalized;
  const key = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(order.phone.replace(/\D/g, "")));
  const customerKey = Array.from(new Uint8Array(key), (b) => b.toString(16).padStart(2, "0")).join("");
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await readState(db, requestId, false, env.productionCheckout);
    if (state.previous) return replay(state.previous, fingerprint);
    if (!state.snapshot) return unavailable();
    const s = overlay(state);
    // Legacy references are already committed to Sheets. Never create a second order on replay.
    const old = s.existing[requestId];
    if (old) {
      if (old.fingerprint !== fingerprint || !(env.productionCheckout ? /^SG-\d+$/ : /^TEST-[A-Za-z0-9-]{1,75}$/).test(old.orderNumber))
        return reply({ ok: false, error: "Request ID conflict" }, 409);
      return reply({
        ok: true,
        ...old,
        fingerprint: undefined,
        duplicate: true,
        paynow: await payments(env).issueShort({ ok: true, ...old }, env),
      });
    }
    const menu = s.bundle.snapshots[order.bakeWindow];
    const validation = validateOrderAgainstMenu(order, menu);
    if (validation.error || order.bakeWindow < getCurrentBatchKey() || order.bakeWindow < s.bundle.currentBatch)
      return reply(
        {
          ok: false,
          errorCode: validation.error?.includes("price changed") ? "PRICE_CHANGED" : "ORDER_UNAVAILABLE",
          error: validation.error || "This batch is closed",
        },
        409,
      );
    const accepted = validation.order;
    const merchCents = order.lineItems.reduce((sum, line) => {
      const product = menu.products.findLast((p) => p.id === line.productId);
      return sum + (product.kind === "merch" ? Math.round(product.priceSgd * 100) * line.quantity : 0);
    }, 0);
    const qualifies =
      order.delivery === COLLECTION_OPTION && Math.round(accepted.itemsTotalSgd * 100) - merchCents >= 3500;
    const referrer =
      qualifies &&
      !s.seen[customerKey] &&
      order.referralCode &&
      Object.keys(s.customers).find((k) => k !== customerKey && s.customers[k] === order.referralCode);
    const credit =
      qualifies && !referrer && s.credits.find((c) => c.key === customerKey && c.expires > Date.now());
    let referralCode = s.customers[customerKey];
    while (!referralCode || (!s.customers[customerKey] && Object.values(s.customers).includes(referralCode)))
      referralCode = "SG" + crypto.randomUUID().slice(0, 6).toUpperCase();
    const result = {
      ok: true,
      orderNumber: env.productionCheckout
        ? "SG-" + String(Math.max(state.lastNumber, s.sequence) + 1).padStart(4, "0")
        : "TEST-" + requestId,
      referralCode,
      referralDiscountSgd: referrer ? 5 : 0,
      creditRedeemedSgd: credit ? 5 : 0,
      amountDueSgd: (Math.round(accepted.totalSgd * 100) - (referrer || credit ? 500 : 0)) / 100,
    };
    const now = Date.now();
    const signed = await payments(env).issue(
      result,
      secret(env),
      Math.floor(now / 1000),
      paymentItemsForOrder(order, menu),
    );
    if (!signed) return unavailable();
    const paymentId = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    const short = new URL(signed.url);
    const token = short.hash.slice(1);
    short.hash = "s." + paymentId;
    result.paynow = { ...signed, url: short.href };
    const hold = {
      batch: order.bakeWindow,
      items: Object.fromEntries(order.lineItems.map((l) => [l.productId, l.quantity])),
      customerKey,
      referralCode,
      credit: credit?.id || "",
    };
    const entry = {
      requestId,
      requestFingerprint: fingerprint,
      orderNumber: result.orderNumber,
      createdAt: now,
      name: order.name,
      phone: order.phone,
      saturdayBatch: order.bakeWindow,
      items: accepted.items,
      total: "S$" + result.amountDueSgd.toFixed(2),
      fulfilment: order.delivery,
      collectionSlot: order.pickupTime,
      deliveryAddress: order.address,
      notes: order.notes,
      customerKey,
      customerReferralCode: referralCode,
      enteredReferralCode: order.referralCode,
      referralDiscount: result.referralDiscountSgd,
      creditRedeemed: result.creditRedeemedSgd,
      creditSourceEventId: hold.credit,
      amountDue: result.amountDueSgd,
      referredByCustomerKey: referrer || "",
    };
    try {
      await bind(
        db,
        `INSERT INTO checkout_orders(request_id,fingerprint,revision,created,receipt,payment_id,token,reserved,ledger_row)
        VALUES(?,?,?,?,?,?,?,?,?)`,
        requestId,
        fingerprint,
        state.revision,
        now,
        JSON.stringify(result),
        paymentId,
        token,
        JSON.stringify(hold),
        JSON.stringify(entry),
      ).run();
    } catch (error) {
      if (/checkout revision changed|UNIQUE constraint failed/.test(String(error.message) + " " + error.cause))
        continue;
      throw error;
    }
    ctx.waitUntil(
      flushCheckout(env).catch(() =>
        console.error("Checkout ledger sync pending; scheduled retry will follow"),
      ),
    );
    return reply(result);
  }
  return unavailable();
}

export async function checkout(request, env, ctx) {
  if (request.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    return reply({ ok: false, error: "Invalid origin" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))
    return reply({ ok: false, error: "Expected JSON" }, 415);
  if (Number(request.headers.get("Content-Length")) > 16000)
    return reply({ ok: false, error: "Order too large" }, 413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 16000) return reply({ ok: false, error: "Order too large" }, 413);
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return reply({ ok: false, error: "Invalid order" }, 400);
  }
  const normalized = normalizeOrderRequest(payload);
  if (normalized.error) return reply({ ok: false, error: normalized.error }, 400);
  if (
    env.TURNSTILE_SECRET_KEY &&
    !(
      typeof payload.turnstileToken === "string" &&
      (await verifyTurnstile(
        payload.turnstileToken,
        env.TURNSTILE_SECRET_KEY,
        request.headers.get("CF-Connecting-IP"),
        normalized.requestId,
      ))
    )
  )
    return reply({ ok: false, error: "Security check failed" }, 403);
  const started = performance.now();
  const response = await accept(env, ctx, normalized, await orderFingerprint(normalized.order));
  response.headers.set("Server-Timing", `checkout;dur=${(performance.now() - started).toFixed(1)}`);
  return response;
}
