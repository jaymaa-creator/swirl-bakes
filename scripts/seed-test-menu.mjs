import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(await readFile(new URL('../wrangler.test.jsonc', import.meta.url), 'utf8'));
const expectedUrl = 'https://script.google.com/macros/s/AKfycbzD0EMRRgCqPPRMyVMeZ6RS_5q8iw8TBKe5njr8HDDK4f7Qq1DhdztW9VdVqUQ_Xng8/exec';
if (config.name !== 'test-swirl-girl' || config.vars?.TEST_APPS_SCRIPT_URL !== expectedUrl ||
    config.kv_namespaces?.find((entry) => entry.binding === 'MENU_SNAPSHOT')?.id !== 'dd1d03c666db445299adbf64c0cc4630') {
  throw new Error('Refusing non-test configuration');
}
const response = await fetch(expectedUrl + '?environment=test');
const menu = await response.json();
if (!response.ok || !menu.ok || !Array.isArray(menu.products) || !/^\d{4}-\d{2}-\d{2}$/.test(menu.batchKey)) throw new Error('Invalid test menu');
const bundle = { ok: true, publishedAt: new Date().toISOString(), currentBatch: menu.batchKey, snapshots: { [menu.batchKey]: menu } };
const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'kv', 'key', 'put', 'isolated-test:menu-snapshots-v1', JSON.stringify(bundle),
  '--binding', 'MENU_SNAPSHOT', '--config', 'wrangler.test.jsonc', '--remote',
], { cwd: new URL('../', import.meta.url), stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Test seed failed');
console.log(`Seeded isolated test menu: ${menu.batchKey}, ${menu.products.length} products. No order writes.`);
