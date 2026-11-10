import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/testWorker.js';
import { resolveTestPayment, handleTestPayment } from '../src/paynowTest.js';

const host = 'https://test-swirl-girl.jaemcd95.workers.dev';
const env = { TEST_ORDER_WEBHOOK_SECRET: 'new-test-secret', ORDER_WEBHOOK_SECRET: 'old-production-secret', TEST_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test-deployment/exec' };
test('test entry refuses production host and missing isolated configuration', async () => {
  assert.equal((await worker.fetch(new Request('https://swirlgirl.sg/api/menu'), env, {})).status, 403);
  assert.equal((await worker.fetch(new Request(host + '/api/menu'), {}, {})).status, 503);
});
test('legacy production publication is ignored without writing storage', async () => {
  const response = await worker.fetch(new Request(host + '/api/menu/sync', { method: 'POST', body: '{}' }), {}, {});
  assert.equal((await response.json()).ignored, true);
});
test('new publisher rejects old production secret', async () => {
  const response = await worker.fetch(new Request(host + '/api/test/menu/sync', {
    method: 'POST', body: JSON.stringify({ secret: 'old-production-secret', products: [] }),
  }), env, {});
  assert.equal(response.status, 401);
});
test('wrong backend identity cannot receive an order', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    const payload = JSON.parse(options.body);
    assert.equal(payload.action, 'testBackendInfo');
    assert.equal(payload.secret, 'new-test-secret');
    return Response.json({ scriptId: 'production', spreadsheetId: 'production', orderWritesEnabled: true });
  });
  const response = await worker.fetch(new Request(host + '/api/orders', { method: 'POST', body: '{}' }), env, {});
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});
test('test menu never falls back to the copied production snapshot or live Sheets', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No Sheets fallback allowed'); });
  const keys = [];
  const response = await worker.fetch(new Request(host + '/api/menu'), { ...env, MENU_SNAPSHOT: { get: async (key) => { keys.push(key); return null; } } }, {});
  assert.equal(response.status, 503);
  assert.ok(keys.every((key) => key.startsWith('isolated-test:')));
});

test('verified isolated backend receives validated test orders with only the new secret', async (t) => {
  const calls = [];
  let menuReads = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, env.TEST_APPS_SCRIPT_URL);
    const payload = JSON.parse(options.body);
    calls.push(payload);
    assert.equal(payload.secret, env.TEST_ORDER_WEBHOOK_SECRET);
    assert.equal(payload.environment, 'test');
    return Response.json(payload.action === 'testBackendInfo' ? {
      scriptId: '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9',
      spreadsheetId: '1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc', orderWritesEnabled: true,
    } : { ok: true, orderNumber: 'TEST-fixture' });
  });
  const batch = '2099-01-03';
  const bundle = { ok: true, currentBatch: batch, snapshots: { [batch]: {
    batchKey: batch, calendar: [{ date: batch, open: true }], products: [{ id: 'cinnamon-rolls', productName: 'Cinnamon Rolls', priceSgd: 35, available: true, remainingQuantity: 10, maxQuantity: 3 }],
  } } };
  const response = await worker.fetch(new Request(host + '/api/orders', {
    method: 'POST', headers: { Origin: host, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: '123e4567-e89b-42d3-a456-426614174000', order: {
      name: 'TEST fixture', phone: '+65 0000 0000', bakeWindow: batch,
      delivery: 'Self-collection - agreed pickup point', pickupTime: '1pm-2pm', address: '', notes: '',
      lineItems: [{ productId: 'cinnamon-rolls', quantity: 1 }], bananaChocolateChips: false, quotedTotalSgd: 35,
    } }),
  }), { ...env, MENU_SNAPSHOT: { get: async (key) => { menuReads++; assert.equal(key, 'isolated-test:menu-snapshots-v1'); return bundle; } } }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).orderNumber, 'TEST-fixture');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].order.totalSgd, 35);
  assert.equal(menuReads, 1);
});


test('test payment enrichment uses saved totals and stable references on replay, never browser quotes', async (t) => {
  const batch = '2099-01-03';
  let saved = { ok: true, orderNumber: 'TEST-paynow-fixture', amountDueSgd: 30, referralDiscountSgd: 5 };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.secret, env.TEST_ORDER_WEBHOOK_SECRET);
    if (payload.action === 'testBackendInfo') return Response.json({
      scriptId: '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9',
      spreadsheetId: '1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc', orderWritesEnabled: true,
    });
    return Response.json(saved);
  });
  const bundle = { ok: true, currentBatch: batch, snapshots: { [batch]: {
    batchKey: batch, calendar: [{ date: batch, open: true }], products: [{ id: 'cinnamon-rolls', productName: 'Cinnamon Rolls', priceSgd: 35, available: true, remainingQuantity: 10, maxQuantity: 3 }],
  } } };
  const linkRecords = new Map();
  let storageFails = false;
  const paymentEnv = { ...env, MENU_SNAPSHOT: {
    get: async key => key === 'isolated-test:menu-snapshots-v1' ? bundle : linkRecords.get(key),
    put: async (key, value) => { if (storageFails) throw new Error('Storage unavailable'); linkRecords.set(key, value); },
  } };
  const submit = () => worker.fetch(new Request(host + '/api/orders', {
    method: 'POST', headers: { Origin: host, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: '123e4567-e89b-42d3-a456-426614174000', order: {
      name: 'TEST fixture', phone: '+65 0000 0000', bakeWindow: batch,
      delivery: 'Self-collection - agreed pickup point', pickupTime: '1pm-2pm', address: '', notes: '',
      lineItems: [{ productId: 'cinnamon-rolls', quantity: 1 }], bananaChocolateChips: false, quotedTotalSgd: 35,
    } }),
  }), paymentEnv, { waitUntil() {} });
  const first = await (await submit()).json();
  assert.equal(first.paynow.amountDueSgd, 30);
  assert.deepEqual(first.paynow.items, [{ name: "Cinnamon Rolls", quantity: 1 }]);
  assert.equal(first.referralDiscountSgd, 5);
  const token = new URL(first.paynow.url).hash.slice(1);
  assert.match(token, /^s\.[A-Za-z0-9_-]{22}$/);
  const resolved = await handleTestPayment(new Request(host + '/api/paynow/resolve', { method: 'POST', headers: { Origin: host, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }), paymentEnv);
  assert.deepEqual((await resolved.json()).paynow, first.paynow);
  assert.equal(await resolveTestPayment(linkRecords.get('isolated-test:paynow-link-v1:' + token.slice(2)), env.ORDER_WEBHOOK_SECRET), null);
  saved = { ...saved, duplicate: true };
  const replay = await (await submit()).json();
  assert.equal(replay.duplicate, true);
  assert.equal(replay.paynow.payload, first.paynow.payload);
  storageFails = true;
  const noLink = await (await submit()).json();
  assert.equal(noLink.ok, true);
  assert.equal(noLink.orderNumber, first.orderNumber);
  assert.equal(noLink.paynow, undefined);
  storageFails = false;
  for (const amountDueSgd of [0, -1, 1.001, null, undefined]) {
    saved = { ...saved, amountDueSgd };
    const result = await (await submit()).json();
    assert.equal(result.ok, true);
    assert.equal(result.paynow, undefined);
  }
  saved = { ok: false, errorCode: 'ORDER_UNAVAILABLE', error: 'Sold out' };
  const rejected = await submit();
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).paynow, undefined);
});

test('payment page headers prevent indexing and referrer leakage; resolver does not access Sheets', async (t) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('No upstream calls for payment page'));
  const response = await worker.fetch(new Request(host + '/pay'), { ASSETS: { fetch: async () => new Response('<html>app</html>') } }, {});
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const invalid = await worker.fetch(new Request(host + '/api/paynow/resolve', { method: 'POST', headers: { Origin: host, 'Content-Type': 'application/json' }, body: '{}' }), env, {});
  assert.equal(invalid.status, 400);
});


test('menu loads while identity check runs and every request gets a fresh snapshot', async (t) => {
  let finishIdentity;
  let reads = 0;
  let writes = 0;
  const identity = new Promise(resolve => { finishIdentity = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (JSON.parse(options.body).action !== 'testBackendInfo') writes++;
    return identity.then(info => Response.json(info));
  });
  const request = () => new Request(host + '/api/orders', { method: 'POST', headers: { Origin: host, 'Content-Type': 'application/json' }, body: '{}' });
  const isolated = { ...env, MENU_SNAPSHOT: { get: async () => { reads++; return { snapshots: {} }; } } };
  const response = worker.fetch(request(), isolated, {});
  await Promise.resolve();
  assert.equal(reads, 1, 'Menu fetch starts before identity response arrives');
  assert.equal(writes, 0);
  finishIdentity({ scriptId: '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9', spreadsheetId: '1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc', orderWritesEnabled: true });
  assert.equal((await response).status, 400);
  assert.equal((await worker.fetch(request(), isolated, {})).status, 400);
  assert.equal(reads, 2, 'No cross-request caching');
  assert.equal(writes, 0);
});

test('test leaderboard reads only isolated score keys', async () => {
  const seen = [];
  const response = await worker.fetch(new Request(host + '/api/game/scores'), { ...env, MENU_SNAPSHOT: {
    get: async () => null,
    put: async () => {},
    list: async ({ prefix }) => { seen.push(prefix); return { keys: [] }; },
  } }, {});
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ['isolated-test:bun-score-v1:']);
});
