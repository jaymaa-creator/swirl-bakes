import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/testWorker.js';

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
  }), { ...env, MENU_SNAPSHOT: { get: async (key) => { assert.equal(key, 'isolated-test:menu-snapshots-v1'); return bundle; } } }, { waitUntil() {} });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).orderNumber, 'TEST-fixture');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].order.totalSgd, 35);
});
