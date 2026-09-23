import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../wrangler.test.jsonc", import.meta.url), "utf8");

const requiredValues = [
  ["test-swirl-girl", "test Worker"],
  ["dd1d03c666db445299adbf64c0cc4630", "test KV namespace"],
  ["abf7bc8e-08dc-4eac-850d-2ce3af083931", "test D1 database"],
];

for (const [value, label] of requiredValues) {
  if (!config.includes(value)) {
    throw new Error(`Test deployment refused: missing ${label}.`);
  }
}

console.log("Test deployment target, KV binding, and D1 binding verified: test-swirl-girl");
