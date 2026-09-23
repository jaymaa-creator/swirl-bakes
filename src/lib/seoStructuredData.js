export function priceOffer(item) {
  if (typeof item.priceSgd !== "number" || !Number.isFinite(item.priceSgd) || item.priceSgd <= 0) {
    return undefined;
  }

  return {
    "@type": "Offer",
    priceCurrency: "SGD",
    price: item.priceSgd,
  };
}

export function productOffer(item, siteUrl) {
  const offer = priceOffer(item);
  if (!offer || !item.image) return undefined;

  let image;
  try {
    image = new URL(item.image, siteUrl).toString();
  } catch {
    return undefined;
  }

  return {
    ...offer,
    itemOffered: {
      "@type": "Product",
      name: item.name,
      description: item.note,
      image,
      offers: { ...offer },
    },
  };
}
