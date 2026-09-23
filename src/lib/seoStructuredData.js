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

export function productOffer(item) {
  const offer = priceOffer(item);
  if (!offer) return undefined;

  return {
    ...offer,
    itemOffered: {
      "@type": "Product",
      name: item.name,
      description: item.note,
      offers: { ...offer },
    },
  };
}
