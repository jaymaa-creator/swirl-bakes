import assert from "node:assert/strict";
import test from "node:test";

import { priceOffer, productOffer } from "../src/lib/seoStructuredData.js";

test("priceOffer uses the live SGD menu price", () => {
  assert.deepEqual(priceOffer({ priceSgd: 18 }), {
    "@type": "Offer",
    priceCurrency: "SGD",
    price: 18,
  });
});

test("productOffer places the real offer inside the Product for Google", () => {
  assert.deepEqual(
    productOffer({
      name: "Pandan Coconut Swirl",
      note: "Pandan dough with coconut and gula Melaka.",
      priceSgd: 18,
    }),
    {
      "@type": "Offer",
      priceCurrency: "SGD",
      price: 18,
      itemOffered: {
        "@type": "Product",
        name: "Pandan Coconut Swirl",
        description: "Pandan dough with coconut and gula Melaka.",
        offers: {
          "@type": "Offer",
          priceCurrency: "SGD",
          price: 18,
        },
      },
    },
  );
});

test("products without a valid live price are omitted from product offers", () => {
  assert.equal(productOffer({ name: "Unavailable", priceSgd: undefined }), undefined);
  assert.equal(productOffer({ name: "Invalid", priceSgd: 0 }), undefined);
});
