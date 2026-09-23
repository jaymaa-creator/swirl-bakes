export const WIDTH = 400;
export const HEIGHT = 560;
export const BIRD_X = 100;
export const RADIUS = 16;
export const GAP = 170;
export function backgroundHouses(elapsed, shops = []) {
  const distance = elapsed * 35;
  const first = Math.floor(distance / 86);
  const colors = ["#e8aca4", "#ecd8a4", "#a9cabc", "#c2b5cf", "#e5b99d"];
  return Array.from({ length: 9 }, (_, offset) => {
    const index = first + offset - 3;
    const number = index + 1;
    if (number < 1 || shops.some((shop) => number > shop.number && number < shop.number + shop.span)) return null;
    const shop = shops.find((shop) => shop.number === number);
    if (index < first && !shop) return null;
    return {
      number, x: index * 86 - distance - 15,
      y: shop ? 330 : index % 2 ? 338 : 350,
      color: colors[index % colors.length],
      shop: shop || null,
    };
  }).filter(Boolean);
}
export function newGame() {
  return { nextShopScore: 30, shops: [], discoveries: [], y: 260, velocity: 0, elapsed: 0, spawn: 0, score: 0, pipes: [], status: "ready" };
}
export function flap(game) {
  if (game.status === "over") return game;
  return { ...game, status: "playing", velocity: -360 };
}
export function stepGame(game, dt, random = Math.random) {
  if (game.status !== "playing") return game;
  const velocity = game.velocity + 850 * dt;
  const y = game.y + velocity * dt;
  let spawn = game.spawn - dt;
  let score = game.score;
  const pipes = game.pipes.map((pipe) => {
    const next = { ...pipe, x: pipe.x - 145 * dt };
    if (!next.passed && next.x + 60 < BIRD_X - RADIUS) {
      next.passed = true;
      score++;
    }
    return next;
  }).filter((pipe) => pipe.x > -65);
  if (spawn <= 0) {
    pipes.push({ x: WIDTH + 20, top: 90 + random() * 190, passed: false, id: game.elapsed });
    spawn = 1.75;
  }
  const hit = y - RADIUS <= 0 || y + RADIUS >= HEIGHT || pipes.some((pipe) =>
    BIRD_X + RADIUS > pipe.x && BIRD_X - RADIUS < pipe.x + 60 &&
    (y - RADIUS < pipe.top || y + RADIUS > pipe.top + GAP));
  const elapsed = game.elapsed + dt;
  const distance = elapsed * 35;
  const shops = game.shops.filter((shop) => shop.number + shop.span > Math.floor(distance / 86));
  let nextShopScore = game.nextShopScore;
  if (!hit && score >= nextShopScore) {
    // Assign the next off-screen house, so an existing facade never changes.
    const number = Math.max(Math.ceil((distance + WIDTH + 15) / 86) + 1, ...shops.map((shop) => shop.number + shop.span));
    shops.push(...createEncounter(score, number, random));
    nextShopScore += 10;
  }
  let discoveries = game.discoveries;
  const visible = shops.filter((shop) => {
    const left = (shop.number - 1) * 86 - distance - 15;
    return left >= 0 && left + shop.span * 86 <= WIDTH;
  });
  const found = visible.map((shop) => shop.id).filter((id) => !discoveries.includes(id));
  if (found.length) discoveries = [...new Set([...discoveries, ...found])];
  return { ...game, discoveries, nextShopScore, shops, y, velocity, pipes, spawn, score, elapsed, status: hit ? "over" : "playing" };
}
import { createEncounter } from "./bunCollection.js";
