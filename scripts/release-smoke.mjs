import { parseExpectedStatuses } from "./release-safety.mjs";

const [baseUrlInput, expectedStatusInput] = process.argv.slice(2);
const baseUrl = new URL(baseUrlInput || "");
const expectedOrderStatuses = parseExpectedStatuses(expectedStatusInput);
const timeoutMs = 12_000;

async function request(path, init = {}, attempts = 1) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(new URL(path, baseUrl), {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "swirl-girl-release-smoke/1", ...init.headers },
      });
      if (response.status >= 500 && attempt < attempts) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
    }
  }
  throw lastError;
}

const homepage = await request("/", {}, 4);
if (!homepage.ok || !(homepage.headers.get("content-type") || "").includes("text/html")) {
  throw new Error(`Homepage smoke check failed: HTTP ${homepage.status}.`);
}

const menuResponse = await request("/api/menu", {}, 4);
if (!menuResponse.ok) throw new Error(`Menu smoke check failed: HTTP ${menuResponse.status}.`);
const menu = await menuResponse.json();
if (menu?.ok !== true || !Array.isArray(menu.products) || menu.products.length === 0) {
  throw new Error("Menu smoke check failed: no usable products were returned.");
}

// Deliberately invalid: the Worker must reject this before Apps Script or Sheets.
const invalidOrder = await request("/api/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: baseUrl.origin },
  body: "{}",
});
if (!expectedOrderStatuses.includes(invalidOrder.status)) {
  throw new Error(
    `Order boundary smoke check failed: expected ${expectedOrderStatuses.join("/")}, got ${invalidOrder.status}.`,
  );
}

console.log(
  `Smoke checks passed for ${baseUrl.origin}: homepage ${homepage.status}, ` +
    `${menu.products.length} menu products, invalid order ${invalidOrder.status}.`,
);
