import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handlePhotos, readLimited, validWebp, servePhoto } from '../src/admin/photos.js';
import { cropRectangle } from '../src/admin/convertPhoto.js';

const host = 'https://test-swirl-girl.jaemcd95.workers.dev';
const photo = new Uint8Array(readFileSync(new URL('./fixtures/admin-photo.webp', import.meta.url)));
const hash = 'a'.repeat(64);
const imageUrl = `${host}/api/media/products/tote-bag/${hash}.webp`;
const loadMenu = async () => ({ products: [{ id: 'tote-bag', imageUrl: '' }] });
function harness() {
  const writes = [];
  const env = { ISOLATED_TEST_BACKEND: true, ADMIN_IMAGES: { put: async (...args) => writes.push(args), head: async () => ({}), get: async () => ({ body: photo, size: photo.length, httpEtag: '"test"' }) }, ORDER_SHEET_WEBHOOK_URL: 'https://script.google.com/test', ORDER_WEBHOOK_SECRET: 'test-secret' };
  const request = (path, method = 'PUT', body = photo, origin = host, type = 'image/webp') => new Request(host + path, { method, headers: { Origin: origin, 'Content-Type': type }, body });
  return { writes, env, request };
}

test('real WebP validation rejects corrupt container, dimension, animation and oversized data', () => {
  assert.equal(validWebp(photo), true);
  assert.equal(validWebp(photo.slice(0, -1)), false);
  assert.equal(validWebp(new Uint8Array(2 * 1024 * 1024 + 1)), false);
  const wrong = photo.slice(); wrong[0] = 0; assert.equal(validWebp(wrong), false);
  // Existing asset is lossy VP8; width starts at byte 26.
  const dimension = photo.slice(); dimension[26] = 1; assert.equal(validWebp(dimension), false);
  const animated = photo.slice(); animated.set(new TextEncoder().encode('ANIM'), 12); assert.equal(validWebp(animated), false);
});

test('crop is centred for portrait and landscape images', () => {
  assert.deepEqual(cropRectangle(1200, 1600), { x: 0, y: 350, width: 1200, height: 900 });
  assert.deepEqual(cropRectangle(2000, 900), { x: 400, y: 0, width: 1200, height: 900 });
});

test('bounded reader stops a chunked request without Content-Length', async () => {
  const request = new Request(host, { method: 'POST', body: new Uint8Array(100) });
  await assert.rejects(readLimited(request, 99));
});

test('photo upload enforces test isolation, origin, product, MIME and content; repeated bytes use same key', async () => {
  const { env, request, writes } = harness();
  const path = '/api/admin/photos/upload?productId=tote-bag';
  const call = (req, target = env) => handlePhotos(req, target, loadMenu, 'admin@example.com');
  assert.equal((await call(request(path), { ...env, ISOLATED_TEST_BACKEND: false })).status, 503);
  assert.equal((await call(request(path, 'PUT', photo, 'https://attacker.test'))).status, 403);
  assert.equal((await call(request(path, 'POST'))).status, 405);
  assert.equal((await call(request(path.replace('tote-bag', 'unknown')))).status, 409);
  assert.equal((await call(request(path, 'PUT', photo, host, 'image/png'))).status, 415);
  assert.equal((await call(request(path, 'PUT', new Uint8Array(20)))).status, 400);
  assert.equal(writes.length, 0);
  const first = await call(request(path)); const second = await call(request(path));
  assert.equal(first.status, 200); assert.deepEqual(await first.json(), await second.json());
  assert.equal(writes[0][0], writes[1][0]);
  assert.match(writes[0][0], /^products\/tote-bag\/[a-f0-9]{64}\.webp$/);
});

test('publication uses authenticated test command, rejects mismatched products and surfaces conflicts/failures', async () => {
  const { env, request } = harness(); const original = globalThis.fetch; let calls = 0; let result = { ok: true };
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, env.ORDER_SHEET_WEBHOOK_URL);
    const data = JSON.parse(options.body);
    assert.equal(data.environment, 'test'); assert.equal(data.action, 'adminProductPhoto'); assert.equal(data.secret, 'test-secret');
    return Response.json(result);
  };
  const call = data => handlePhotos(request('/api/admin/photos/publish', 'POST', JSON.stringify(data), host, 'application/json'), env, loadMenu, 'admin@example.com');
  try {
    const payload = { productId: 'tote-bag', imageUrl, previousImageUrl: '' };
    assert.equal((await call({ ...payload, productId: 'banana-bread' })).status, 400);
    assert.equal(calls, 0);
    assert.equal((await call(payload)).status, 200);
    result = { ok: false, errorCode: 'PHOTO_CONFLICT' }; assert.equal((await call(payload)).status, 409);
    result = { ok: false, saved: true }; const failed = await call(payload); assert.equal(failed.status, 503); assert.match((await failed.json()).error, /saved/);
  } finally { globalThis.fetch = original; }
});

test('public media is read-only, test-only and constrained to image keys', async () => {
  const { env } = harness();
  const response = await servePhoto(new Request(imageUrl), env); assert.equal(response.status, 200); assert.equal(response.headers.get('Content-Type'), 'image/webp');
  assert.equal((await servePhoto(new Request(imageUrl, { method: 'DELETE' }), env)).status, 405);
  assert.equal((await servePhoto(new Request(imageUrl.replace(host, 'https://swirlgirl.sg')), env)).status, 404);
  assert.equal((await servePhoto(new Request(`${host}/api/media/anything`), env)).status, 404);
});

function scriptHarness(scriptId = '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9') {
  const rows = [['product_id', 'image_url'], ['tote-bag', '']]; let writes = 0; let publishes = 0; let failPublish = false;
  const sheet = { getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }), getRange: (r, c) => ({ setValue(value) { writes++; rows[r - 1][c - 1] = value; } }) };
  const context = vm.createContext({ console, ScriptApp: { getScriptId: () => scriptId }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }, SpreadsheetApp: { openById: () => ({ getSheetByName: name => name === 'Merch' ? sheet : null }), flush() {} } });
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context);
  context.publishMenuSnapshot = () => { publishes++; if (failPublish) throw new Error('network'); return { ok: true }; };
  return { context, rows, counts: () => ({ writes, publishes }), fail: value => { failPublish = value; } };
}

test('Sheet update is idempotent, checks stale edits, and reports saved-but-unpublished state', () => {
  const h = scriptHarness(); const payload = { productId: 'tote-bag', imageUrl, previousImageUrl: '', environment: 'test' };
  assert.equal(h.context.updateAdminProductPhoto({ ...payload, environment: 'production' }).ok, false);
  assert.equal(h.context.updateAdminProductPhoto({ ...payload, productId: 'missing' }).ok, false);
  assert.equal(h.context.updateAdminProductPhoto(payload).ok, true);
  assert.equal(h.context.updateAdminProductPhoto(payload).ok, true);
  assert.deepEqual(h.counts(), { writes: 1, publishes: 2 });
  const changed = { ...payload, imageUrl: imageUrl.replace(hash, 'b'.repeat(64)) };
  assert.equal(h.context.updateAdminProductPhoto(changed).errorCode, 'PHOTO_CONFLICT');
  h.fail(true);
  const pending = h.context.updateAdminProductPhoto({ ...changed, previousImageUrl: imageUrl });
  assert.equal(pending.saved, true); assert.equal(pending.ok, false);
  h.fail(false);
  assert.equal(h.context.updateAdminProductPhoto({ ...changed, previousImageUrl: imageUrl }).ok, true);
  assert.equal(h.counts().writes, 2);
});

test('zoom and position preserve 4:3 and keep every crop within the source', () => {
  assert.deepEqual(cropRectangle(1200, 900, 2, 1, 0), { x: 600, y: 0, width: 600, height: 450 });
  for (const [w, h] of [[600, 2400], [2400, 600], [1200, 900]]) {
    for (const z of [0, 1, 1.5, 3, 10]) for (const x of [-1, 0, 0.5, 1, 2]) {
      const c = cropRectangle(w, h, z, x, 1 - x);
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.width <= w && c.y + c.height <= h);
      assert.ok(Math.abs(c.width / c.height - 4 / 3) < 1e-12);
    }
  }
});


test('production photo writes stay on production and reject test images and scripts', async () => {
  const { env } = harness(); const prodEnv = { ...env, ISOLATED_TEST_BACKEND: false };
  const origin = 'https://swirlgirl.sg';
  const request = new Request(origin + '/api/admin/photos/upload?productId=tote-bag', { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'image/webp' }, body: photo });
  const uploaded = await handlePhotos(request, prodEnv, loadMenu, 'admin@example.com');
  assert.equal(uploaded.status, 200);
  const data = await uploaded.json(); assert.ok(data.imageUrl.startsWith(origin + '/api/media/'));
  assert.equal((await servePhoto(new Request(data.imageUrl), prodEnv)).status, 200);
  assert.equal((await servePhoto(new Request(imageUrl), prodEnv)).status, 404);
  const h = scriptHarness('1YfNLgt5YZnDv8CwcR9zcGICM4v0jjfMCs9lzD_pWVh5M8O5Yc5xMVnhf');
  const payload = { productId: 'tote-bag', imageUrl: imageUrl.replace(host, origin), previousImageUrl: '', environment: 'production' };
  assert.equal(h.context.updateAdminProductPhoto({ ...payload, imageUrl }).ok, false);
  assert.equal(h.context.updateAdminProductPhoto({ ...payload, environment: 'test' }).ok, false);
  assert.equal(h.context.updateAdminProductPhoto(payload).ok, true);
  assert.deepEqual(h.counts(), { writes: 1, publishes: 1 });
  assert.equal(scriptHarness('unknown-project').context.updateAdminProductPhoto(payload).ok, false);
});


test('existing mixed-case Sourdough product IDs support upload, serving and Sheet publication', async () => {
  const { env, request, writes } = harness();
  const uploaded = await handlePhotos(request('/api/admin/photos/upload?productId=Sourdough'), env, async () => ({ products: [{ id: 'Sourdough' }] }), 'admin@example.com');
  assert.equal(uploaded.status, 200);
  assert.ok(writes[0][0].startsWith('products/Sourdough/'));
  const imageUrl = (await uploaded.json()).imageUrl;
  assert.equal((await servePhoto(new Request(imageUrl), env)).status, 200);
  const h = scriptHarness(); h.rows[1][0] = 'Sourdough';
  assert.equal(h.context.updateAdminProductPhoto({ productId: 'Sourdough', imageUrl, previousImageUrl: '', environment: 'test' }).ok, true);
});
