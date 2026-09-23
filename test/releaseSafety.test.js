import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_CONFIRMATION,
  parseExpectedStatuses,
  validateProductionDeploy,
  validateReleaseSha,
} from "../scripts/release-safety.mjs";

const productionConfig = '{\n  "name": "swirl-girl",\n}';

test("release SHAs must be full and immutable", () => {
  assert.equal(validateReleaseSha("a".repeat(40)), "a".repeat(40));
  assert.throws(() => validateReleaseSha("main"), /40-character commit SHA/);
  assert.throws(() => validateReleaseSha("a".repeat(39)), /40-character commit SHA/);
});

test("local production deploy requires all safety gates", () => {
  assert.doesNotThrow(() => validateProductionDeploy({
    confirmation: PRODUCTION_CONFIRMATION,
    config: productionConfig,
    branch: "main",
    status: "",
  }));
  assert.throws(() => validateProductionDeploy({
    confirmation: "yes",
    config: productionConfig,
    branch: "main",
    status: "",
  }), /DEPLOY_PRODUCTION_CONFIRM/);
  assert.throws(() => validateProductionDeploy({
    confirmation: PRODUCTION_CONFIRMATION,
    config: productionConfig,
    branch: "feature",
    status: "",
  }), /main/);
  assert.throws(() => validateProductionDeploy({
    confirmation: PRODUCTION_CONFIRMATION,
    config: productionConfig,
    branch: "main",
    status: " M src/worker.js",
  }), /working-tree/);
  assert.throws(() => validateProductionDeploy({
    confirmation: PRODUCTION_CONFIRMATION,
    config: '{ "name": "test-swirl-girl" }',
    branch: "main",
    status: "",
  }), /not targeting swirl-girl/);
});

test("smoke checks accept only valid HTTP statuses", () => {
  assert.deepEqual(parseExpectedStatuses("400, 403"), [400, 403]);
  assert.throws(() => parseExpectedStatuses("nope"), /expected order status/);
});
