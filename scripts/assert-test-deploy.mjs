import { readFile } from "node:fs/promises";

const config = await readFile(new URL("../wrangler.test.jsonc", import.meta.url), "utf8");
const target = JSON.parse(config);
if (target.name !== "test-swirl-girl" || target.main !== "./src/testWorker.js"
    || target.routes?.length || target.env
    || target.vars?.TEST_APPS_SCRIPT_URL !== "https://script.google.com/macros/s/AKfycbzD0EMRRgCqPPRMyVMeZ6RS_5q8iw8TBKe5njr8HDDK4f7Qq1DhdztW9VdVqUQ_Xng8/exec"
    || target.kv_namespaces?.length !== 1 || target.kv_namespaces[0].binding !== "MENU_SNAPSHOT"
    || target.kv_namespaces[0].id !== "dd1d03c666db445299adbf64c0cc4630"
    || target.r2_buckets?.length !== 1 || target.r2_buckets[0].binding !== "ADMIN_IMAGES"
    || target.r2_buckets[0].bucket_name !== "swirl-girl-admin-test"
    || target.d1_databases?.length !== 1 || target.d1_databases[0].binding !== "PAYMENT_ORDERS"
    || target.d1_databases[0].database_id !== "abf7bc8e-08dc-4eac-850d-2ce3af083931") {
  throw new Error("Test deployment refused: target, backend or bindings are not isolated.");
}

const requiredValues = [
  ["test-swirl-girl", "test Worker"],
  ["swirl-girl-admin-test", "test photo bucket"],
  ["dd1d03c666db445299adbf64c0cc4630", "test KV namespace"],
  ["abf7bc8e-08dc-4eac-850d-2ce3af083931", "test D1 database"],
];

for (const [value, label] of requiredValues) {
  if (!config.includes(value)) {
    throw new Error(`Test deployment refused: missing ${label}.`);
  }
}

console.log("Test deployment target, KV binding, and D1 binding verified: test-swirl-girl");
