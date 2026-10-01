import worker from './worker.js';

const HOST = 'test-swirl-girl.jaemcd95.workers.dev';
const SCRIPT_ID = '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9';
const SHEET_ID = '1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname !== HOST) return reply({ ok: false, error: 'Test host only' }, 403);
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
    const kv = env.MENU_SNAPSHOT;
    const isolated = {
      ...env,
      ISOLATED_TEST_BACKEND: true,
      ORDER_WEBHOOK_SECRET: env.TEST_ORDER_WEBHOOK_SECRET,
      ORDER_SHEET_WEBHOOK_URL: env.TEST_APPS_SCRIPT_URL,
      MENU_SETTINGS_URL: env.TEST_APPS_SCRIPT_URL,
      MENU_SNAPSHOT: kv && {
        get: (key, ...args) => kv.get('isolated-test:' + key, ...args),
        put: (key, ...args) => kv.put('isolated-test:' + key, ...args),
      },
    };
    if (['/api/menu', '/api/stock', '/api/orders'].includes(url.pathname)) {
      const bundle = kv && await kv.get('isolated-test:menu-snapshots-v1', 'json');
      if (!bundle) return reply({ ok: false, error: 'Publish the isolated test menu before testing orders' }, 503);
    }
    return worker.fetch(request, isolated, ctx);
  },
};
