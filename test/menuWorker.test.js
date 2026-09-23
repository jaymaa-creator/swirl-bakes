import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

test("published inventory bypasses stale edge caches across hosts and consecutive reads", async (t) => {
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  t.after(() => {
    if (originalCaches) Object.defineProperty(globalThis, "caches", originalCaches);
    else delete globalThis.caches;
  });
  globalThis.caches = { default: {
    match: async () => assert.fail("Published inventory must not read old edge caches"),
    put: async () => assert.fail("Published inventory must not populate edge caches"),
  } };
  let sold = 6;
  const batch = "2026-09-19";
  const env = { MENU_SNAPSHOT: { get: async () => ({
    ok: true, currentBatch: batch, snapshots: { [batch]: {
      ok: true, batchKey: batch,
      products: [{ id: "cinnamon-rolls", soldQuantity: sold, remainingQuantity: 6 - sold }],
      shopping: { batchKey: batch, generatedAt: "2026-09-10T04:19:21.813Z", items: [] },
    } },
  }) } };
  for (const host of ["swirlgirl.sg", "swirl-girl.jaemcd95.workers.dev", "test-swirl-girl.jaemcd95.workers.dev"]) {
    for (sold of [6, 5]) {
      const response = await worker.fetch(new Request(`https://${host}/api/menu?batch=${batch}`), env, {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal((await response.json()).products[0].remainingQuantity, 6 - sold);
    }
  }
  const stock = await worker.fetch(new Request(`https://test-swirl-girl.jaemcd95.workers.dev/api/stock?batch=${batch}`), env, {});
  assert.equal(stock.status, 200);
  assert.equal(stock.headers.get("Cache-Control"), "no-store");
});
