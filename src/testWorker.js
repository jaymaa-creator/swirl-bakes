import { isAdminPath } from "./admin/access.js";
import { handleTestPayment, issueShortTestPayment, paymentItemsForOrder } from "./paynowTest.js";
import worker from './worker.js';

const HOST = 'test-swirl-girl.jaemcd95.workers.dev';
const SCRIPT_ID = '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9';
const SHEET_ID = '1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname !== HOST) return reply({ ok: false, error: 'Test host only' }, 403);
    if (url.pathname === '/api/paynow/resolve') return handleTestPayment(request, env);
    if (url.pathname === '/pay' || url.pathname === '/pay/') {
      const asset = await env.ASSETS.fetch(request);
      const response = new Response(asset.body, asset);
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    }
    if (isAdminPath(url.pathname) && !['/api/admin/reports', '/api/admin/menu', '/api/admin/photos/upload', '/api/admin/photos/publish'].includes(url.pathname)) return worker.fetch(request, { ...env, ISOLATED_TEST_BACKEND: true }, ctx);
    // Retire the old production publisher without changing production's script or
    // causing its monitoring to report a failed publish. Nothing is persisted.
    if (url.pathname === '/api/menu/sync') {
      return reply({ ok: true, ignored: true, reason: 'Test menu has a separate publisher' });
    }
    if (!env.TEST_ORDER_WEBHOOK_SECRET || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.TEST_APPS_SCRIPT_URL || '')) {
      if (url.pathname.startsWith('/api/')) return reply({ ok: false, error: 'Test backend is not configured' }, 503);
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === '/api/test/menu/sync') {
      url.pathname = '/api/menu/sync';
      request = new Request(url, request);
    }
    // One fresh snapshot per request. Start it alongside the identity check;
    // reuse it for validation and item labels, never across customer requests.
    const kv = env.MENU_SNAPSHOT;
    const needsMenu = ['/api/menu', '/api/stock', '/api/orders'].includes(url.pathname);
    const bundlePromise = needsMenu
      ? Promise.resolve().then(() => kv?.get('isolated-test:menu-snapshots-v1', 'json')).catch(() => null)
      : null;
    // Check the authenticated target identity before any order write. A wrong
    // deployment URL fails closed instead of relaying into a production Sheet.
    if (url.pathname === '/api/orders') {
      try {
        const response = await fetch(env.TEST_APPS_SCRIPT_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: env.TEST_ORDER_WEBHOOK_SECRET, environment: 'test', action: 'testBackendInfo' }),
        });
        const info = await response.json();
        if (!response.ok || info.scriptId !== SCRIPT_ID || info.spreadsheetId !== SHEET_ID || info.orderWritesEnabled !== true) throw new Error('Mismatch');
      } catch {
        return reply({ ok: false, error: 'Test backend isolation check failed' }, 503);
      }
    }
    // Use a distinct key prefix so old published snapshots cannot leak into test.
    const isolated = {
      ...env,
      ISOLATED_TEST_BACKEND: true,
      ORDER_WEBHOOK_SECRET: env.TEST_ORDER_WEBHOOK_SECRET,
      ORDER_SHEET_WEBHOOK_URL: env.TEST_APPS_SCRIPT_URL,
      MENU_SETTINGS_URL: env.TEST_APPS_SCRIPT_URL,
      MENU_SNAPSHOT: kv && {
        get: (key, ...args) => bundlePromise && key === 'menu-snapshots-v1' && args[0] === 'json'
          ? bundlePromise : kv.get('isolated-test:' + key, ...args),
        put: (key, ...args) => kv.put('isolated-test:' + key, ...args),
        list: async (options) => {
          const result = await kv.list({ ...options, prefix: 'isolated-test:' + options.prefix });
          return { ...result, keys: result.keys.map((key) => ({ ...key, name: key.name.slice('isolated-test:'.length) })) };
        },
      },
    };
    let bundle;
    if (needsMenu) {
      bundle = await bundlePromise;
      if (!bundle) return reply({ ok: false, error: 'Publish the isolated test menu before testing orders' }, 503);
    }
    const orderRequest = url.pathname === '/api/orders' ? request.clone() : null;
    const response = await worker.fetch(request, isolated, ctx);
    if (url.pathname !== '/api/orders' || !response.ok) return response;
    // Enrich only the final validated backend result, including exact replays.
    // QR failure must never disguise a successfully saved order as a failure.
    try {
      const result = await response.clone().json();
      const { order } = await orderRequest.json();
      const items = paymentItemsForOrder(order, bundle?.snapshots?.[order.bakeWindow.trim()]);
      const paynow = await issueShortTestPayment(result, env, undefined, items || undefined);
      if (paynow) return reply({ ...result, paynow });
    } catch { /* Saved receipt and manual WhatsApp handoff remain available. */ }
    return response;
  },
};
