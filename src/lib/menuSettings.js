const DEFAULT_MAX_QUANTITY = 3;
const DEFAULT_PRODUCT_IMAGES = {
  sourdough: "/sourdough.webp",
};

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "available", "on"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "sold out", "soldout", "off"].includes(normalized)) return false;
  return fallback;
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function toNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function toQuantityOptions(value) {
  const maxQuantity = Math.floor(toNonNegativeNumber(value) ?? DEFAULT_MAX_QUANTITY);
  return Array.from({ length: maxQuantity }, (_, index) => index + 1);
}

function toText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function productNameFromId(productId) {
  if (String(productId).trim().toLowerCase() === "banana-bread") return "Banana Loaf";

  return String(productId)
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function fallbackProduct(productId, productSettings) {
  const isLoaf = /bread|sourdough|loaf/i.test(productId);
  const name = productNameFromId(productId);

  return {
    id: productId,
    name,
    category: "Weekly bakes",
    unitLabel: isLoaf ? "per loaf" : "each",
    quantityLabel: isLoaf ? "loaf" : "item",
    quantityLabelPlural: isLoaf ? "loaves" : "items",
    note: productSettings.description || "Freshly baked for this Saturday's batch.",
    allergens: productSettings.allergens || "Allergen information available on request.",
    image: productSettings.imageUrl || DEFAULT_PRODUCT_IMAGES[productId.toLowerCase()] || "",
    imageAlt: name,
  };
}

export function normalizeMenuSettings(settings = {}) {
  const products = Array.isArray(settings.products) ? settings.products : [];

  return new Map(
    products
      .filter((product) => typeof product?.id === "string" && product.id.trim())
      .map((product) => [
        product.id.trim(),
        {
          available: toBoolean(product.available, true),
          batchLimit: toPositiveNumber(product.batchLimit),
          maxQuantity: toPositiveNumber(product.maxQuantity),
          priceSgd: toPositiveNumber(product.priceSgd),
          remainingQuantity: toNonNegativeNumber(product.remainingQuantity),
          soldQuantity: toNonNegativeNumber(product.soldQuantity),
          description: toText(product.description),
          allergens: toText(product.allergens),
          imageUrl: toText(product.imageUrl),
        },
      ])
  );
}

export function mergeMenuSettings(baseMenu, settings) {
  const settingsById = normalizeMenuSettings(settings);
  const baseIds = new Set(baseMenu.map((item) => item.id));

  const menu = baseMenu.map((item) => {
    const productSettings = settingsById.get(item.id);
    const customerMaxQuantity = productSettings?.maxQuantity || DEFAULT_MAX_QUANTITY;
    const effectiveMaxQuantity =
      productSettings?.remainingQuantity === null || productSettings?.remainingQuantity === undefined
        ? customerMaxQuantity
        : Math.min(customerMaxQuantity, productSettings.remainingQuantity);
    const isAvailable = (productSettings?.available ?? true) && effectiveMaxQuantity > 0;

    return {
      ...item,
      available: isAvailable,
      batchLimit: productSettings?.batchLimit,
      // Prices only come from the live Products sheet. There is intentionally no static fallback.
      priceSgd: productSettings?.priceSgd ?? null,
      note: productSettings?.description || item.note,
      allergens: productSettings?.allergens || item.allergens,
      image: productSettings?.imageUrl || item.image,
      remainingQuantity: productSettings?.remainingQuantity,
      soldQuantity: productSettings?.soldQuantity,
      quantityOptions: toQuantityOptions(effectiveMaxQuantity),
    };
  });

  settingsById.forEach((productSettings, productId) => {
    const isConfiguredForSale =
      productSettings.available &&
      productSettings.priceSgd !== null &&
      productSettings.batchLimit !== null &&
      productSettings.remainingQuantity !== null &&
      productSettings.remainingQuantity > 0;

    // Sheet-only products stay private until their stock configuration is complete.
    if (baseIds.has(productId) || !isConfiguredForSale) return;

    const item = fallbackProduct(productId, productSettings);
    const customerMaxQuantity = productSettings.maxQuantity || DEFAULT_MAX_QUANTITY;
    const effectiveMaxQuantity =
      productSettings.remainingQuantity === null || productSettings.remainingQuantity === undefined
        ? customerMaxQuantity
        : Math.min(customerMaxQuantity, productSettings.remainingQuantity);

    menu.push({
      ...item,
      available: effectiveMaxQuantity > 0,
      batchLimit: productSettings.batchLimit,
      priceSgd: productSettings.priceSgd,
      remainingQuantity: productSettings.remainingQuantity,
      soldQuantity: productSettings.soldQuantity,
      quantityOptions: toQuantityOptions(effectiveMaxQuantity),
    });
  });

  return menu;
}
