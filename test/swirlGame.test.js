import test from "node:test";
import assert from "node:assert/strict";
import { newGame, flap, stepGame, backgroundHouses } from "../src/lib/swirlGame.js";
test("shops begin at 30 points, then appear every 10 points with random shop types", () => {
  const game = { ...flap(newGame()), velocity: 0, spawn: 1, score: 29 };
  assert.equal(stepGame(game, 0.016).shops.length, 0);
  for (const [roll, id, target] of [[0, "dog-0", 40], [0.999, "night-2", 40]]) {
    const next = stepGame({ ...game, score: 30 }, 0.016, () => roll);
    assert.equal(next.shops.length, 1);
    assert.equal(next.shops[0].id, id);
    assert.equal(next.nextShopScore, target);
    assert.equal(stepGame(next, 0.016).shops.length, 1);
    assert.equal(stepGame({ ...next, score: target - 1 }, 0.016).shops.length, 1);
    assert.equal(stepGame({ ...next, score: target }, 0.016, () => roll).nextShopScore, target + 10);
  }
});
test("assigned shops stay stable as they scroll and reset with a new game", () => {
  const shops = [{ number: 4, id: "night-0", span: 1 }];
  const before = backgroundHouses(0, shops);
  const after = backgroundHouses(3, shops);
  for (const house of after.filter((house) => house.number <= 6)) {
    assert.equal(house.shop, before.find((old) => old.number === house.number).shop);
  }
  assert.deepEqual(newGame().shops, []);
  assert.equal(newGame().nextShopScore, 30);
  assert.ok(backgroundHouses(1)[0].x < backgroundHouses(0)[0].x);
});
test("a finished run cannot be restarted by flap input", () => {
  const game = { ...newGame(), status: "over", score: 23 };
  assert.equal(flap(game), game);
  assert.equal(stepGame(game, 0.016), game);
});
test("game waits for input and flap lifts the swirl", () => {
  const game = newGame();
  assert.equal(stepGame(game, 1), game);
  assert.equal(flap(game).velocity, -360);
  assert.ok(stepGame(flap(game), 0.016).y < game.y);
});
test("obstacles score once and collisions end the game", () => {
  const game = { ...flap(newGame()), y: 260, velocity: 0, spawn: 1, pipes: [{ x: 22, top: 180, passed: false }] };
  const next = stepGame(game, 0.016);
  assert.equal(next.score, 1);
  assert.equal(stepGame(next, 0.016).score, 1);
  assert.equal(stepGame({ ...game, y: 559 }, 0.016).status, "over");
  assert.equal(stepGame({ ...game, pipes: [{ x: 100, top: 280 }] }, 0.016).status, "over");
});
