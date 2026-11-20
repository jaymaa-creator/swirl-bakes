import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import production from "../src/productionWorker.js";
import worker from "../src/testWorker.js";
import { publishCheckout, checkoutMenu, flushCheckout } from "../src/cloudCheckout.js";
import { COLLECTION_OPTION, DELIVERY_OPTION } from "../src/config/orderPolicy.js";
import { buildTestScript, TEST_SCRIPT_ID, TEST_SHEET_ID } from "../scripts/build-test-apps-script.mjs";
import vm from "node:vm";

const host = "https://test-swirl-girl.jaemcd95.workers.dev";
const date = "2099-01-03";
const sql = readFileSync(new URL("../test-checkout/schema.sql", import.meta.url), "utf8");
const order = (qty = 1) => ({
  name: "Test fixture",
  phone: "00000000",
  bakeWindow: date,
  delivery: COLLECTION_OPTION,
  pickupTime: "1pm-2pm",
  lineItems: [{ productId: "bun", quantity: qty }],
  quotedTotalSgd: qty * 20,
});
const fixture = (stock = 3) => ({
  captured: Date.now(),
  seen: {},
  existing: {},
  customers: {},
  credits: [],
  bundle: {
    ok: true,
    currentBatch: date,
    snapshots: {
      [date]: {
        batchKey: date,
        calendar: [{ date, open: true }],
        products: [
          {
            id: "bun",
            productName: "Bun",
            available: true,
            priceSgd: 20,
            maxQuantity: 3,
            remainingQuantity: stock,
          },
        ],
      },
    },
  },
});
function database(withSequence = false) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(sql);
  if (withSequence) sqlite.exec(readFileSync(new URL("../test-checkout/production-schema.sql",import.meta.url), "utf8"));
  const stmt = (query, args = []) => ({
    bind: (...values) => stmt(query, values),
    run: async () => sqlite.prepare(query).run(...args),
    first: async () => sqlite.prepare(query).get(...args),
    all: async () => ({ results: sqlite.prepare(query).all(...args) }),
    read: () => ({ results: sqlite.prepare(query).all(...args) }),
  });
  return {
    prepare: stmt,
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        const result = statements.map((s) => s.read());
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
async function setup(t, snapshot = fixture()) {
  const db = database();
  await publishCheckout(db, snapshot);
  const env = {
    TEST_D1_CHECKOUT: "1",
    TEST_APPS_SCRIPT_URL: "https://script.google.com/macros/s/test/exec",
    TEST_ORDER_WEBHOOK_SECRET: "fixture",
    PAYMENT_ORDERS: db,
  };
  const tasks = [],
    calls = [],
    ledger = new Map();
  let resume;
  const stalled = new Promise((resolve) => {
    resume = resolve;
  });
  t.mock.method(globalThis, "fetch", async (_, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.action);
    await stalled;
    if (body.action === "checkoutBootstrap")
      return Response.json({
        ok: true,
        scriptId: TEST_SCRIPT_ID,
        spreadsheetId: TEST_SHEET_ID,
        checkout: snapshot,
      });
    assert.equal(body.action, "appendCloudOrder");
    ledger.set(body.entry.requestId, body.entry);
    return Response.json({ ok: true, requestId: body.entry.requestId, orderNumber: body.entry.orderNumber });
  });
  const ctx = { waitUntil: (p) => tasks.push(p) };
  const request = (path, body) =>
    worker.fetch(
      new Request(host + path, {
        method: "POST",
        headers: { Origin: host, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env,
      ctx,
    );
  return {
    db,
    env,
    ledger,
    calls,
    resume,
    request,
    submit: (o, id) => request("/api/orders", { order: o, requestId: id || crypto.randomUUID() }),
    tasks,
  };
}

test("test checkout and exact QR finish while Sheets is stalled; concurrent last-box submissions and replay are safe", async (t) => {
  const f = await setup(t, fixture(1)),
    id = crypto.randomUUID();
  const first = await f.submit(order(), id);
  assert.equal(first.status, 200);
  const saved = await first.json();
  assert.equal(saved.amountDueSgd, 20);
  assert.equal(saved.paynow.orderNumber, saved.orderNumber);
  assert.deepEqual([...f.ledger], []);
  const retry = await (await f.submit(order(), id)).json();
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.paynow, saved.paynow);
  assert.equal((await f.submit({ ...order(), name: "changed" }, id)).status, 409);
  assert.equal((await f.submit(order())).status, 409);
  f.env.TEST_D1_CHECKOUT = "0"; // Existing links survive switching the order writer back.
  const resolved = await (
    await f.request("/api/paynow/resolve", { token: new URL(saved.paynow.url).hash.slice(1) })
  ).json();
  assert.equal(resolved.paynow.amountDueSgd, 20);
  assert.equal((await checkoutMenu(f.db)).snapshots[date].products[0].remainingQuantity, 0);
  f.resume();
  await Promise.all(f.tasks);
  await flushCheckout(f.env);
  assert.equal(f.ledger.size, 1);
  assert.equal(f.calls.filter((x) => x === "appendCloudOrder").length, 1);
});

test("concurrent requests for final stock allow only one reservation", async (t) => {
  const f = await setup(t, fixture(1));
  const results = await Promise.all([f.submit(order()), f.submit(order())]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  f.resume();
  await Promise.all(f.tasks);
});

test("delivery, first pickup referral and FIFO credit parity, stale publication and cancellation", async (t) => {
  const baseline = fixture(20);
  const key = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("00000000"))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  baseline.customers.referring = "SGABC123";
  baseline.credits = [{ id: "earned", key, expires: Date.now() + 100000 }];
  const f = await setup(t, baseline);
  const first = await (await f.submit({ ...order(2), referralCode: "SGABC123" })).json();
  assert.equal(first.referralDiscountSgd, 5);
  assert.equal(first.amountDueSgd, 35);
  const second = await (await f.submit(order(2))).json();
  assert.equal(second.creditRedeemedSgd, 5);
  const third = await (await f.submit(order(2))).json();
  assert.equal(third.amountDueSgd, 40);
  const delivery = await (
    await f.submit({
      ...order(2),
      delivery: DELIVERY_OPTION,
      address: "Test address",
      pickupTime: "",
      quotedTotalSgd: 55,
    })
  ).json();
  assert.equal(delivery.amountDueSgd, 55);
  f.resume();
  await Promise.all(f.tasks);
  const published = structuredClone(baseline);
  published.captured += 100;
  for (const [id, entry] of f.ledger)
    published.existing[id] = { orderNumber: entry.orderNumber, fingerprint: entry.requestFingerprint };
  // Operator cancels the orders in Sheets; the authoritative snapshot restores the stock.
  await publishCheckout(f.db, published);
  await publishCheckout(f.db, baseline);
  assert.equal((await checkoutMenu(f.db)).snapshots[date].products[0].remainingQuantity, 20);
});

test("ledger append retries lost acknowledgements without writing a second Sheet row", () => {
  const source = buildTestScript(readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8"));
  let row;
  const sheet = {};
  const context = vm.createContext({
    ScriptApp: { getScriptId: () => TEST_SCRIPT_ID },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
  });
  vm.runInContext(source, context);
  context.TEST_ensureOrderRequestColumns = () => {};
  context.TEST_ensureReferralSheets = () => {};
  context.TEST_findOrderRequest = () => row;
  context.TEST_findReferralCustomerByKey = () => ({ code: "SG123ABC" });
  context.TEST_reconcileReferralLedgerForSavedOrders = () => {};
  context.TEST_parseCalendarDate = () => new Date();
  context.TEST_appendOrderRow = (_, entry) => {
    assert.equal(row, undefined);
    row = entry;
  };
  const entry = {
    orderNumber: "TEST-demo",
    requestId: crypto.randomUUID(),
    requestFingerprint: "a".repeat(64),
    amountDue: 20,
    customerReferralCode: "SG123ABC",
    saturdayBatch: date,
    createdAt: Date.now(),
    phone: "00000000",
    name: "=formula",
    items: "Bun x1",
    total: "S$20.00",
    fulfilment: COLLECTION_OPTION,
  };
  assert.equal(context.TEST_appendCloudOrder(entry).ok, true);
  assert.equal(context.TEST_appendCloudOrder(entry).ok, true);
  assert.notEqual(row.name, "=formula");
  assert.equal(row.paid, false);
  assert.throws(() => context.TEST_appendCloudOrder({ ...entry, requestFingerprint: "b".repeat(64) }), /conflict/);
});

test("a failed ledger append retries after its lease expires; stock stays reserved through acknowledgement", async (t) => {
  const base = fixture(2),
    f = await setup(t, base);
  let sends = 0;
  const ledger = new Map();
  t.mock.method(globalThis, "fetch", async (_, options) => {
    const body = JSON.parse(options.body);
    if (body.action === "checkoutBootstrap")
      return Response.json({ ok: true, scriptId: TEST_SCRIPT_ID, spreadsheetId: TEST_SHEET_ID, checkout: base });
    sends++;
    const entry = body.entry;
    ledger.set(entry.requestId, entry);
    if (sends === 1) throw Error("lost acknowledgement after append");
    return Response.json({ ok: true, requestId: entry.requestId, orderNumber: entry.orderNumber });
  });
  assert.equal((await f.submit(order())).status, 200);
  await Promise.all(f.tasks);
  await flushCheckout(f.env);
  assert.equal(sends, 1);
  await f.db.prepare("UPDATE checkout_orders SET retry_after=0").run();
  await flushCheckout(f.env);
  assert.equal(sends, 2);
  assert.equal(ledger.size, 1);
  assert.equal((await checkoutMenu(f.db)).snapshots[date].products[0].remainingQuantity, 1);
  assert.equal((await f.db.prepare("SELECT ledger_row FROM checkout_orders").first()).ledger_row, null);
});

test("test prices reject stale quotes and share tote stock across bake dates", async (t) => {
  const s = fixture(3);
  const next = "2099-01-10";
  const batch = s.bundle.snapshots[date];
  batch.products.push({
    id: "tote",
    kind: "merch",
    available: true,
    maxQuantity: 1,
    remainingQuantity: 1,
    priceSgd: 10,
  });
  batch.calendar.push({ date: next, open: true });
  s.bundle.snapshots[next] = { ...structuredClone(batch), batchKey: next };
  const f = await setup(t, s);
  const basket = {
    ...order(),
    lineItems: [...order().lineItems, { productId: "tote", quantity: 1 }],
    quotedTotalSgd: 30,
  };
  assert.equal((await (await f.submit({ ...basket, quotedTotalSgd: 29 })).json()).errorCode, "PRICE_CHANGED");
  assert.equal((await f.submit(basket)).status, 200);
  assert.equal((await f.submit({ ...basket, bakeWindow: next })).status, 409);
  assert.equal((await checkoutMenu(f.db)).snapshots[next].products[0].remainingQuantity, 3);
  f.resume();
  await Promise.all(f.tasks);
});

test("production checkout preserves the SG sequence, replays the same QR, and reuses older short links", async t => {
  const db = database(true);
  const snapshot = {...fixture(5), sequence:85, writerActive:true};
  await publishCheckout(db,snapshot);
  const legacyTokens = new Map();
  const env = {PAYMENT_ORDERS:db, MENU_SNAPSHOT:{get:key=>legacyTokens.get(key)}, ORDER_WEBHOOK_SECRET:"fixture",
    ORDER_SHEET_WEBHOOK_URL:"https://script.google.com/macros/s/AKfycbzUOOucRMDQ7cIg90tXNtPrN0NmRtV1oepoVoswGwHXkTo8anTjqOsM3xUyBRBmugGs/exec"};
  const tasks = [], calls = [];
  t.mock.method(globalThis,"fetch",async (_,options)=>{
    const body=JSON.parse(options.body);
    assert.equal(body.environment,"production");
    if(body.action==="checkoutBootstrap") return Response.json({ok:true,scriptId:"1YfNLgt5YZnDv8CwcR9zcGICM4v0jjfMCs9lzD_pWVh5M8O5Yc5xMVnhf",
      spreadsheetId:"12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A",checkout:snapshot});
    calls.push(body.entry);
    return Response.json({ok:true,requestId:body.entry.requestId,orderNumber:body.entry.orderNumber});
  });
  const request=async(host,path,body)=>{
    const origin="https://"+host;
    const res=await production.fetch(new Request(origin+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)}),env,{waitUntil:p=>tasks.push(p)});
    assert.equal(res.status,200);return res.json();
  };
  const body={requestId:crypto.randomUUID(),order:order()};
  const [a,b]=await Promise.all([request("swirlgirl.sg","/api/orders",body),request("www.swirlgirl.sg","/api/orders",{...body,requestId:crypto.randomUUID()})]);
  assert.deepEqual([a.orderNumber,b.orderNumber].sort(),["SG-0086","SG-0087"]);
  const duplicate=await request("www.swirlgirl.sg","/api/orders",body);
  assert.equal(duplicate.duplicate,true);assert.deepEqual(duplicate.paynow,a.paynow);
  for(const receipt of [a,b]){
    const link=new URL(receipt.paynow.url);assert.equal(link.origin,"https://swirlgirl.sg");
    const resolved=await request("swirlgirl.sg","/api/paynow/resolve",{token:link.hash.slice(1)});
    assert.equal(resolved.paynow.orderNumber,receipt.orderNumber);assert.equal(resolved.paynow.amountDueSgd,20);
  }
  const token=(await db.prepare("SELECT token FROM checkout_orders LIMIT 1").first()).token;
  const oldId="A".repeat(22);legacyTokens.set("production:paynow-link-v1:"+oldId,token);
  assert.equal((await request("swirlgirl.sg","/api/paynow/resolve",{token:"s."+oldId})).ok,true);
  await Promise.all(tasks);assert.equal(calls.length,2);
});
