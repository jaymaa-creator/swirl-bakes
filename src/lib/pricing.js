import { BANANA_CHOCOLATE_CHIPS_PRICE_SGD } from "../config/orderPolicy.js";

export function money(n) {
  if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return "TBC";
  return `S$${Number(n).toFixed(2)}`;
}

export { BANANA_CHOCOLATE_CHIPS_PRICE_SGD };

export function calculateAddOnTotalSgd(form) {
  if (!form.bananaChocolateChips) return 0;
  return Math.max(0, Number(form.items?.["banana-bread"]) || 0) * BANANA_CHOCOLATE_CHIPS_PRICE_SGD;
}

function normalizePricing(item) {
  if (item.pricing) return item.pricing;
  if (typeof item.priceSgd === "number") {
    return { mode: "per_item", unitPriceSgd: item.priceSgd };
  }
  return { mode: "unpriced" };
}

export function calculateLineTotalSgd(item, qty) {
  const safeQty = Math.max(0, Number(qty) || 0);
  const pricing = normalizePricing(item);

  if (pricing.mode === "per_item") {
    return safeQty * Number(pricing.unitPriceSgd || 0);
  }

  if (pricing.mode === "per_pack") {
    const packSize = Math.max(1, Number(pricing.packSize) || 1);
    const packPriceSgd = Number(pricing.packPriceSgd || 0);
    const partialPackPolicy = pricing.partialPackPolicy || "prorate";

    if (partialPackPolicy === "floor") {
      return Math.floor(safeQty / packSize) * packPriceSgd;
    }

    if (partialPackPolicy === "ceil") {
      return Math.ceil(safeQty / packSize) * packPriceSgd;
    }

    return (safeQty / packSize) * packPriceSgd;
  }

  return 0;
}

export function hasSelectedBakes(menu, items) {
  return menu.some((item) => item.kind !== "merch" && item.available !== false && Number(items?.[item.id] || 0) > 0);
}

export function clearMerchWithoutBakes(form, menu) {
  if (hasSelectedBakes(menu, form.items)) return form;
  const items = { ...form.items };
  menu.filter((item) => item.kind === "merch").forEach((item) => { items[item.id] = 0; });
  return { ...form, items };
}

export function calculateBakesTotalSgd(form, menu) {
  return menu.filter((item) => item.kind !== "merch").reduce(
    (sum, item) => sum + calculateLineTotalSgd(item, form.items?.[item.id]), 0
  ) + calculateAddOnTotalSgd(form);
}
