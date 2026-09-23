const DEFAULT_MAX_QUANTITY = 3;
const DEFAULT_PRODUCT_IMAGES = {
  "chocolate-chip-cookies": "/chocolate-chip-cookies.webp",
  "milo-swirl": "/milo-swirl.webp",
  "pandan-swirl": "/pandan-swirl.webp",
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

function toSentenceCase(value) {
  const text = toText(value);
  return text ? text.toLowerCase() : "";
}

function productNameFromId(productId) {
  if (String(productId).trim().toLowerCase() === "banana-bread") return "Banana Cake";

  return String(productId)
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pluralizeLabel(label) {
  const words = label.trim().split(/\s+/);
  if (words.length === 0) return "items";

  const lastWord = words.at(-1).toLowerCase();
  const irregular = {
    loaf: "loaves",
    box: "boxes",
  };

  let pluralLastWord = irregular[lastWord];
  if (!pluralLastWord) {
    if (/(s|x|z|ch|sh)$/i.test(lastWord)) pluralLastWord = `${lastWord}es`;
    else if (/[^aeiou]y$/i.test(lastWord)) pluralLastWord = `${lastWord.slice(0, -1)}ies`;
    else pluralLastWord = `${lastWord}s`;
  }

  return [...words.slice(0, -1), pluralLastWord].join(" ");
}

function getUnitMeta(perText, productId) {
  const normalizedPer = toSentenceCase(perText).replace(/^per\s+/, "");
  if (normalizedPer) {
    const quantityRoot = normalizedPer.includes(" of ")
      ? normalizedPer.split(/\s+of\s+/i)[0].trim()
      : normalizedPer;

    return {
      unitLabel: `per ${normalizedPer}`,
      quantityLabel: quantityRoot,
      quantityLabelPlural: pluralizeLabel(quantityRoot),
      orderDescription: normalizedPer,
    };
  }

  const isLoaf = /bread|sourdough|loaf/i.test(productId);
  return {
    unitLabel: isLoaf ? "per loaf" : "each",
    quantityLabel: isLoaf ? "loaf" : "item",
    quantityLabelPlural: isLoaf ? "loaves" : "items",
    orderDescription: isLoaf ? "loaf" : "item",
  };
}

function fallbackProduct(productId, productSettings) {
  const isSourdough = String(productId).trim().toLowerCase() === "sourdough";
  const name = productSettings.productName || productNameFromId(productId);
  const unitMeta = getUnitMeta(productSettings.per, productId);

  return {
    id: productId,
    name,
    category: isSourdough ? "Staples" : "Weekly bakes",
    unitLabel: unitMeta.unitLabel,
    quantityLabel: unitMeta.quantityLabel,
    quantityLabelPlural: unitMeta.quantityLabelPlural,
    orderDescription: unitMeta.orderDescription,
    note: productSettings.description || "Freshly baked for your selected batch.",
    allergens: productSettings.allergens,
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
          special: toBoolean(product.special, false),
          batchLimit: toPositiveNumber(product.batchLimit),
          maxQuantity: toPositiveNumber(product.maxQuantity),
          priceSgd: toPositiveNumber(product.priceSgd),
          remainingQuantity: toNonNegativeNumber(product.remainingQuantity),
          soldQuantity: toNonNegativeNumber(product.soldQuantity),
          productName: toText(product.productName),
          description: toText(product.description),
          allergens: toText(product.allergens),
          per: toText(product.per),
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
    if (productSettings && productSettings.available === false) return null;

    const unitMeta = getUnitMeta(productSettings?.per, item.id);
    const customerMaxQuantity = productSettings?.maxQuantity || DEFAULT_MAX_QUANTITY;
    const effectiveMaxQuantity =
      productSettings?.remainingQuantity === null || productSettings?.remainingQuantity === undefined
        ? customerMaxQuantity
        : Math.min(customerMaxQuantity, productSettings.remainingQuantity);
    const isAvailable = (productSettings?.available ?? true) && effectiveMaxQuantity > 0;

    return {
      ...item,
      name: productSettings?.productName || item.name,
      unitLabel: productSettings?.per ? unitMeta.unitLabel : item.unitLabel,
      quantityLabel: productSettings?.per ? unitMeta.quantityLabel : item.quantityLabel,
      quantityLabelPlural: productSettings?.per ? unitMeta.quantityLabelPlural : item.quantityLabelPlural,
      orderDescription: productSettings?.per ? unitMeta.orderDescription : item.orderDescription,
      imageAlt: productSettings?.productName || item.imageAlt,
      available: isAvailable,
      special: Boolean(productSettings?.special) && isAvailable,
      batchLimit: productSettings?.batchLimit,
      // Prices only come from the live Products sheet. There is intentionally no static fallback.
      priceSgd: productSettings?.priceSgd ?? null,
      note: productSettings?.description || item.note,
      allergens: productSettings ? productSettings.allergens : item.allergens,
      image: productSettings?.imageUrl || item.image,
      remainingQuantity: productSettings?.remainingQuantity,
      soldQuantity: productSettings?.soldQuantity,
      quantityOptions: toQuantityOptions(effectiveMaxQuantity),
    };
  }).filter(Boolean);

  settingsById.forEach((productSettings, productId) => {
    // Availability decides whether customers can order this batch, not whether
    // a fully configured product is visible. This keeps sold-out bakes visible
    // with their sold-out treatment instead of making them appear to vanish.
    const isConfiguredForMenu =
      productSettings.priceSgd !== null &&
      productSettings.batchLimit !== null &&
      productSettings.remainingQuantity !== null;

    // Sheet-only products stay private until their stock configuration is complete
    // or when they are manually hidden in the Products sheet.
    if (baseIds.has(productId) || !isConfiguredForMenu || productSettings.available === false) return;

    const item = fallbackProduct(productId, productSettings);
    const customerMaxQuantity = productSettings.maxQuantity || DEFAULT_MAX_QUANTITY;
    const effectiveMaxQuantity =
      productSettings.remainingQuantity === null || productSettings.remainingQuantity === undefined
        ? customerMaxQuantity
        : Math.min(customerMaxQuantity, productSettings.remainingQuantity);

    const isAvailable = productSettings.available && effectiveMaxQuantity > 0;

    menu.push({
      ...item,
      available: isAvailable,
      special: Boolean(productSettings.special) && isAvailable,
      batchLimit: productSettings.batchLimit,
      priceSgd: productSettings.priceSgd,
      remainingQuantity: productSettings.remainingQuantity,
      soldQuantity: productSettings.soldQuantity,
      quantityOptions: toQuantityOptions(effectiveMaxQuantity),
    });
  });

  return menu;
}
