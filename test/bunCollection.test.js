import test from "node:test";
import assert from "node:assert/strict";
import { COLLECTIBLES, createEncounter, mergeCollection, readCollection, scoreMessage, itemById } from "../src/lib/bunCollection.js";
import { newGame, flap, stepGame, backgroundHouses } from "../src/lib/swirlGame.js";

test("all scene families are reachable, never below their thresholds", () => {
  assert.equal(COLLECTIBLES.length, 15);
  assert.deepEqual(createEncounter(29, 8), []);
  const seen = new Set();
  for (const score of [30, 40, 50, 60, 80, 100]) {
    for (let i = 0; i < 100; i++) {
      for (const scene of createEncounter(score, 10, () => i / 100)) {
        assert.ok(itemById(scene.id).threshold <= score);
        seen.add(itemById(scene.id).kind);
      }
    }
  }
  assert.equal(seen.size, 7);
});
test("Vietnamese row is four adjacent distinct restaurants and bike bar spans two plots", () => {
  let rolls = [0.99, 0, 0];
  const row = createEncounter(50, 10, () => rolls.shift() ?? 0);
  assert.deepEqual(row.map((s) => s.number), [10, 11, 12, 13]);
  assert.deepEqual(row.map((s) => itemById(s.id).name), ["Banh Mi", "Pho", "Saigon", "Little Hanoi"]);
  const bar = createEncounter(80, 3, () => .999);
  assert.equal(bar[0].id, "motorbike");
  assert.equal(bar[0].span, 2);
  const houses = backgroundHouses(0, bar);
  assert.equal(houses.filter((h) => h.number === 4).length, 0);
});
test("dog coats, neon options and crowd combinations all randomize", () => {
  const dogs = new Set(); const crowds = new Set(); const neons = new Set();
  for (let n = 0; n < 12; n++) {
    let rolls = [0, n / 12, n / 12, n / 12];
    const scene = createEncounter(30, 9, () => rolls.shift());
    dogs.add(scene[0].id); crowds.add(scene[0].crowd); neons.add(scene[0].neon);
  }
  assert.equal(dogs.size, 4); assert.equal(crowds.size, 3); assert.equal(neons.size, 3);
});
test("collect when fully visible, including the crash frame, without duplicates", () => {
  const game = { ...flap(newGame()), velocity: 0, spawn: 1, shops: [{ number: 5, id: "dog-0", span: 1 }] };
  assert.deepEqual(stepGame(game, 0.016).discoveries, []);
  const passed = stepGame({ ...game, elapsed: 1 }, 0.016);
  assert.deepEqual(passed.discoveries, ["dog-0"]);
  assert.deepEqual(stepGame(passed, 0.016).discoveries, ["dog-0"]);
  assert.deepEqual(stepGame({ ...game, elapsed: 1, y: 559 }, 0.016).discoveries, ["dog-0"]);
  assert.deepEqual(mergeCollection(["dog-0"], ["dog-0", "coffee", "bad"]), ["dog-0", "coffee"]);
});
test("wide buildings wait for their whole footprint and off-screen scenes are not collected", () => {
  const game = { ...flap(newGame()), velocity: 0, spawn: 1, shops: [{ number: 4, id: "motorbike", span: 2 }] };
  assert.deepEqual(stepGame(game, 0.016).discoveries, []);
  assert.deepEqual(stepGame({ ...game, elapsed: 1 }, 0.016).discoveries, ["motorbike"]);
  assert.deepEqual(stepGame({ ...game, elapsed: 8 }, 0.016).discoveries, []);
});
test("wide scenes remain until their entire footprint has scrolled away", () => {
  const game = { ...flap(newGame()), velocity: 0, spawn: 1, elapsed: 9, shops: [{ number: 2, id: "heritage", span: 3 }] };
  const next = stepGame(game, 0.016);
  assert.equal(next.shops.length, 1);
  assert.ok(backgroundHouses(next.elapsed, next.shops).some((h) => h.shop?.id === "heritage"));
});
test("collection storage tolerates invalid or unavailable storage", () => {
  assert.deepEqual(readCollection({ getItem: () => '["coffee","coffee","unknown"]' }), ["coffee"]);
  for (const value of ["oops", "{}", "null", "42"]) assert.deepEqual(readCollection({ getItem: () => value }), []);
  assert.deepEqual(readCollection({ getItem: () => { throw Error("blocked"); } }), []);
});
test("Singlish messages track score bands", () => {
  assert.equal(scoreMessage(0), "Aaiyoo, not good.");
  assert.equal(scoreMessage(3), "Why so bad ah?");
  assert.equal(scoreMessage(10), "Must try harder wan");
  assert.equal(scoreMessage(30), "Not bad lor");
  assert.equal(scoreMessage(60), "Very good lah!");
});
