import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { validateProductionDeploy } from "./release-safety.mjs";

const config = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

validateProductionDeploy({
  confirmation: process.env.DEPLOY_PRODUCTION_CONFIRM,
  config,
  branch: git("branch", "--show-current"),
  status: git("status", "--porcelain"),
});

console.log("Production target, confirmation, main branch, and clean working tree verified.");
