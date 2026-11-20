import storefront from "./worker.js";
import { checkout, checkoutMenu, flushCheckout, publishCheckout, refreshCheckout, relay } from "./cloudCheckout.js";
import { productionPayments } from "./paynowPayments.js";

const hosts = new Set(["swirlgirl.sg", "www.swirlgirl.sg"]);
const ledgerUrl = "https://script.google.com/macros/s/AKfycbzUOOucRMDQ7cIg90tXNtPrN0NmRtV1oepoVoswGwHXkTo8anTjqOsM3xUyBRBmugGs/exec";
const unavailable = () => Response.json({ok:false,error:"Checkout is temporarily unavailable. Please try again."}, {status:503,headers:{"Cache-Control":"no-store"}});

async function maintain(env) {
  if (env.ORDER_SHEET_WEBHOOK_URL !== ledgerUrl) throw Error("Unexpected production ledger target");
  const db = env.PAYMENT_ORDERS;
  const state = await db.prepare("SELECT captured FROM checkout_baseline WHERE id=1").first();
  if (state.captured) return flushCheckout(env);
  // The candidate probe uses a disposable copy before the stable web app is upgraded.
  const {probe_ok} = await db.prepare("SELECT probe_ok FROM checkout_sequence WHERE id=1").first();
  if (!probe_ok) {
    const ack = await relay(env,"checkoutSchemaProbe",{},env.CHECKOUT_PROBE_URL);
    if (ack.probe !== "passed" || ack.copyRemoved !== true) throw Error("Production schema probe incomplete");
    await db.prepare("UPDATE checkout_sequence SET probe_ok=1 WHERE id=1").run();
  }
  await refreshCheckout(env);
}

export default {
  async scheduled(event, bindings, ctx) {
    ctx.waitUntil(maintain({...bindings,productionCheckout:true}));
  },
  async fetch(request, bindings, ctx) {
    const url = new URL(request.url);
    if (!hosts.has(url.hostname)) return storefront.fetch(request, bindings, ctx);
    const env = {...bindings,productionCheckout:true};
    const db = env.PAYMENT_ORDERS;
    const kv = env.MENU_SNAPSHOT;
    if (url.pathname === "/api/paynow/resolve") {
      return productionPayments.handle(request, {...env, MENU_SNAPSHOT:{async get(key) {
        let row;
        try {
          row = await db.prepare("SELECT token FROM checkout_orders WHERE payment_id=?").bind(key.split(":").at(-1)).first();
        } catch (error) {
          const legacy = await kv.get(key);
          if (legacy) return legacy;
          throw error;
        }
        return row?.token || kv.get(key);
      }}});
    }
    if (url.pathname === "/api/menu/sync" && request.method === "POST") {
      const payload = await request.clone().json().catch(()=>null);
      if (env.ORDER_WEBHOOK_SECRET && payload?.secret === env.ORDER_WEBHOOK_SECRET && payload.checkout?.writerActive === true) {
        const snapshot = {...payload.checkout, bundle:{ok:true,currentBatch:payload.currentBatch,snapshots:payload.snapshots}};
        if (!Number.isSafeInteger(snapshot.sequence)) return unavailable();
        const result = await storefront.fetch(request, env, ctx);
        if (result.ok) await publishCheckout(db,snapshot);
        return result;
      }
    }
    if (url.pathname === "/api/orders") {
      if (env.ORDER_SHEET_WEBHOOK_URL !== ledgerUrl || !env.ORDER_WEBHOOK_SECRET) return unavailable();
      try {
        const state = await db.prepare("SELECT captured FROM checkout_baseline WHERE id=1").first();
        if (state?.captured) return await checkout(request, env, ctx);
      } catch { return unavailable(); }
      // Old writer remains available through staging. Apps Script fences it under its order lock at cutover.
    }
    if (url.pathname === "/api/menu" || url.pathname === "/api/admin/stock") {
      env.MENU_SNAPSHOT = {
        get: async (key,...args) => key === "menu-snapshots-v1" && args[0] === "json"
          ? (await checkoutMenu(db)) || kv.get(key,...args) : kv.get(key,...args),
        put: (...args) => kv.put(...args), list: (...args) => kv.list(...args),
      };
    }
    return storefront.fetch(request,env,ctx);
  },
};
