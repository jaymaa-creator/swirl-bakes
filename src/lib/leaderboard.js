const SCORE_PREFIX = "bun-score-v1:";
const RUN_PREFIX = "bun-run-v1:";
const RATE_PREFIX = "bun-rate-v1:";
const MAX_SCORE = 200;
const MAX_RUN_MS = 60 * 60 * 1000;
const CHARACTERS = /^[A-Z0-9!?*+-]{3}$/;

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function topScores(kv) {
  const listed = await kv.list({ prefix: SCORE_PREFIX, limit: 10 });
  return listed.keys.map(({ metadata }) => ({ initials: metadata.initials, score: metadata.score }))
    .filter((row) => CHARACTERS.test(row.initials) && Number.isInteger(row.score));
}

async function readPayload(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return null;
  if (Number(request.headers.get("Content-Length") || 0) > 256) return null;
  const body = await request.arrayBuffer();
  if (body.byteLength > 256) return null;
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { return null; }
}

export async function handleLeaderboard(request, env, url) {
  if (!env.MENU_SNAPSHOT?.get || !env.MENU_SNAPSHOT?.put || !env.MENU_SNAPSHOT?.list) {
    return reply({ ok: false, error: "Scoreboard is unavailable" }, 503);
  }
  const kv = env.MENU_SNAPSHOT;
  if (url.pathname === "/api/game/scores" && request.method === "GET") {
    return reply({ ok: true, scores: await topScores(kv) });
  }
  if (request.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  if (!["swirlgirl.sg", "www.swirlgirl.sg", "test-swirl-girl.jaemcd95.workers.dev"].includes(url.hostname) ||
      request.headers.get("Origin") !== url.origin) return reply({ ok: false, error: "Invalid origin" }, 403);

  if (url.pathname === "/api/game/start") {
    const runId = crypto.randomUUID();
    await kv.put(RUN_PREFIX + runId, String(Date.now()), { expirationTtl: 3600 });
    return reply({ ok: true, runId });
  }
  if (url.pathname !== "/api/game/scores") return reply({ ok: false, error: "Not found" }, 404);
  const payload = await readPayload(request);
  const initials = typeof payload?.initials === "string" ? payload.initials.toUpperCase() : "";
  const score = payload?.score;
  const runId = payload?.runId;
  if (!CHARACTERS.test(initials) || !Number.isInteger(score) || score < 1 || score > MAX_SCORE ||
      typeof runId !== "string" || !/^[0-9a-f-]{36}$/.test(runId)) {
    return reply({ ok: false, error: "Enter three letters, numbers or arcade symbols" }, 400);
  }
  const startedAt = Number(await kv.get(RUN_PREFIX + runId));
  const elapsed = Date.now() - startedAt;
  if (!startedAt || elapsed < 0 || elapsed > MAX_RUN_MS || score > Math.floor(elapsed / 1500) + 2) {
    return reply({ ok: false, error: "This run cannot be submitted" }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipBytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", ipBytes);
  const ipHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (await kv.get(RATE_PREFIX + ipHash)) return reply({ ok: false, error: "Please wait a minute before posting again" }, 429);
  const scoreKey = SCORE_PREFIX + String(MAX_SCORE - score).padStart(3, "0") + ":" + runId;
  if (await kv.get(scoreKey)) return reply({ ok: false, error: "This run was already submitted" }, 409);
  await kv.put(scoreKey, "1", { metadata: { initials, score } });
  await kv.put(RATE_PREFIX + ipHash, "1", { expirationTtl: 60 });
  return reply({ ok: true, scores: await topScores(kv) });
}
