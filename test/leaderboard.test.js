import test from "node:test";
import assert from "node:assert/strict";
import { handleLeaderboard } from "../src/lib/leaderboard.js";

function storage() {
  const records = new Map();
  return {
    async get(key) { return records.get(key)?.value || null; },
    async put(key, value, options = {}) { records.set(key, { value, metadata: options.metadata }); },
    async list({ prefix, limit }) {
      return { keys: [...records].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))
        .slice(0, limit).map(([name, record]) => ({ name, metadata: record.metadata })) };
    },
  };
}
const url = new URL("https://swirlgirl.sg/api/game/scores");
const call = (kv, path, method = "GET", body, ip = "1.1.1.1") => handleLeaderboard(
  new Request(`https://swirlgirl.sg${path}`, { method, headers: {
    Origin: "https://swirlgirl.sg", "Content-Type": "application/json", "CF-Connecting-IP": ip,
  }, ...(body ? { body: JSON.stringify(body) } : {}) }), { MENU_SNAPSHOT: kv }, new URL(`https://swirlgirl.sg${path}`));

test("a finished run accepts three arcade characters and ranks the score", async () => {
  const kv = storage();
  const start = await (await call(kv, "/api/game/start", "POST")).json();
  const response = await call(kv, "/api/game/scores", "POST", { runId: start.runId, initials: "a!1", score: 1 });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).scores, [{ initials: "A!1", score: 1 }]);
  assert.equal((await call(kv, "/api/game/scores", "POST", { runId: start.runId, initials: "A!1", score: 1 })).status, 429);
});
test("rejects malformed, oversized, forged, cross-origin and implausible submissions", async () => {
  const kv = storage();
  const start = await (await call(kv, "/api/game/start", "POST")).json();
  for (const initials of ["AB", "ABCD", "A@C", "<x>"])
    assert.equal((await call(kv, "/api/game/scores", "POST", { runId: start.runId, initials, score: 1 })).status, 400);
  assert.equal((await call(kv, "/api/game/scores", "POST", { runId: start.runId, initials: "ABC", score: 100 })).status, 400);
  assert.equal((await call(kv, "/api/game/scores", "POST", { runId: crypto.randomUUID(), initials: "ABC", score: 1 })).status, 400);
  const foreign = await handleLeaderboard(new Request(url, { method: "POST", headers: { Origin: "https://other.example" } }), { MENU_SNAPSHOT: kv }, url);
  assert.equal(foreign.status, 403);
  assert.deepEqual((await (await call(kv, "/api/game/scores")).json()).scores, []);
});
test("top ten is sorted by score without collecting player identity", async () => {
  const kv = storage();
  for (let score = 1; score <= 12; score++) {
    await kv.put(`bun-score-v1:${String(200 - score).padStart(3, "0")}:${crypto.randomUUID()}`, "1", { metadata: { initials: "BUN", score } });
  }
  const result = await (await call(kv, "/api/game/scores")).json();
  assert.equal(result.scores.length, 10);
  assert.deepEqual(result.scores.map((row) => row.score), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  assert.deepEqual(Object.keys(result.scores[0]).sort(), ["initials", "score"]);
});
