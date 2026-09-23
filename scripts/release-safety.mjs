export const PRODUCTION_CONFIRMATION = "DEPLOY swirl-girl";

export function validateReleaseSha(value) {
  if (!/^[0-9a-f]{40}$/i.test(value || "")) {
    throw new Error("Release refused: release_sha must be a full 40-character commit SHA.");
  }
  return value.toLowerCase();
}

export function validateProductionDeploy({ confirmation, config, branch, status }) {
  if (confirmation !== PRODUCTION_CONFIRMATION) {
    throw new Error(
      `Production deployment refused: set DEPLOY_PRODUCTION_CONFIRM='${PRODUCTION_CONFIRMATION}'.`,
    );
  }
  if (!/^\s*"name"\s*:\s*"swirl-girl"\s*,?\s*$/m.test(config)) {
    throw new Error("Production deployment refused: wrangler.jsonc is not targeting swirl-girl.");
  }
  if (branch !== "main") {
    throw new Error("Production deployment refused: local deployments must run from main.");
  }
  if (status.trim()) {
    throw new Error("Production deployment refused: commit or stash every working-tree change first.");
  }
}

export function parseExpectedStatuses(value) {
  const statuses = String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 100 && item <= 599);
  if (!statuses.length) throw new Error("At least one expected order status is required.");
  return statuses;
}

export function isRetryableSmokeStatus(status) {
  return status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}
