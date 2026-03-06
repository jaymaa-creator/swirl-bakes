export function money(n) {
  if (!n) return "TBC";
  return `S$${Number(n).toFixed(0)}`;
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
