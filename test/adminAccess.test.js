import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from '../src/worker.js';
import testWorker from '../src/testWorker.js';

const issuer = 'https://admin-test.cloudflareaccess.com';
const audience = 'test-admin-audience';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const env = { ADMIN_ACCESS_ISSUER: issuer, ADMIN_ACCESS_AUD: audience, ADMIN_EMAILS: 'owner@example.com,partner@example.com', ASSETS: { fetch: async () => new Response('<html>Admin shell</html>', { headers: { 'Content-Type': 'text/html' } }) } };
async function token(email = 'owner@example.com', overrides = {}, key = privateKey) {
  return new SignJWT({ email, ...overrides }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(overrides.iss || issuer).setAudience(overrides.aud || audience).setSubject('google-user').setIssuedAt().setExpirationTime(overrides.exp || '1h').sign(key);
}
const request = (path, jwt, method = 'GET') => new Request(`https://test-swirl-girl.jaemcd95.workers.dev${path}`, { method, headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {} });

test('admin access rejects missing configuration and credentials on pages and all API paths', async () => {
  for (const path of ['/admin', '/admin/', '/admin/future', '/api/admin', '/api/admin/session', '/api/admin/future', '/api/admin/menu', '/api/admin/photos/upload', '/api/admin/photos/publish', '/api/admin/reports']) {
    assert.equal((await worker.fetch(request(path), {}, {})).status, 503);
    assert.equal((await worker.fetch(request(path), env, {})).status, 401);
    assert.equal((await testWorker.fetch(request(path), {}, {})).status, 503);
  }
});

test('signed admin identities, expiry, audience, issuer and signature are enforced', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] });
  };
  try {
    for (const email of ['owner@example.com', 'partner@example.com']) {
      const response = await worker.fetch(request('/api/admin/session', await token(email)), env, {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { email, role: 'admin', environment: 'production', reportsEnabled: true });
    }
    assert.equal((await worker.fetch(request('/admin', await token('stranger@example.com')), env, {})).status, 403);
    for (const claims of [{ exp: 1 }, { aud: 'another-app' }, { iss: 'https://other.cloudflareaccess.com' }]) {
      assert.equal((await worker.fetch(request('/admin', await token('owner@example.com', claims)), env, {})).status, 401);
    }
    const attacker = await generateKeyPair('RS256');
    assert.equal((await worker.fetch(request('/admin', await token('owner@example.com', {}, attacker.privateKey)), env, {})).status, 401);
    assert.equal((await worker.fetch(request('/admin', 'invalid.jwt.token'), env, {})).status, 401);
    const valid = await token();
    const page = await worker.fetch(request('/admin', valid), env, {});
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(await page.text(), /Admin shell/);
    assert.equal((await worker.fetch(request('/api/admin/future', valid), env, {})).status, 404);
    assert.equal((await worker.fetch(request('/api/admin/session', valid, 'POST'), env, {})).status, 405);
    const testSession = await testWorker.fetch(request('/api/admin/session', valid), env, {});
    assert.equal(testSession.status, 200);
    assert.equal((await testSession.json()).reportsEnabled, true);
    assert.equal((await worker.fetch(request('/api/admin/reports', valid), env, {})).status, 503);
    const keys = [];
    const batch = '2099-01-03';
    const photoEnv = { ...env, TEST_ORDER_WEBHOOK_SECRET: 'test-secret', TEST_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec', ADMIN_IMAGES: {}, MENU_SNAPSHOT: {
      get: async key => { keys.push(key); return { ok: true, currentBatch: batch, snapshots: { [batch]: { batchKey: batch, calendar: [{ date: batch, open: true }], products: [{ id: 'tote-bag', priceSgd: 10 }] } } }; },
    } };
    const menu = await testWorker.fetch(request('/api/admin/menu', valid), photoEnv, {});
    assert.equal(menu.status, 200);
    assert.equal((await menu.json()).products[0].id, 'tote-bag');
    assert.deepEqual(keys, ['isolated-test:menu-snapshots-v1']);
    for (const path of ['/api/admin/menu', '/api/admin/photos/upload', '/api/admin/photos/publish', '/api/admin/reports']) {
      assert.equal((await testWorker.fetch(request(path), photoEnv, {})).status, 401);
      assert.equal((await testWorker.fetch(request(path, await token('stranger@example.com')), photoEnv, {})).status, 403);
    }

  } finally { globalThis.fetch = originalFetch; }
});
