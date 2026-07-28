const DEFAULT_MAX_QUANTITY = 3;

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
        },
      ])
  );
}

export function mergeMenuSettings(baseMenu, settings) {
  const settingsById = normalizeMenuSettings(settings);

  return baseMenu.map((item) => {
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
      priceSgd: productSettings?.priceSgd || item.priceSgd,
      remainingQuantity: productSettings?.remainingQuantity,
      soldQuantity: productSettings?.soldQuantity,
      quantityOptions: toQuantityOptions(effectiveMaxQuantity),
    };
  });
}
