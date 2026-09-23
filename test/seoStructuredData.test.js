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
      image: "/pandan-coconut.webp",
    }, "https://swirlgirl.sg"),
    {
      "@type": "Offer",
      priceCurrency: "SGD",
      price: 18,
      itemOffered: {
        "@type": "Product",
        name: "Pandan Coconut Swirl",
        description: "Pandan dough with coconut and gula Melaka.",
        image: "https://swirlgirl.sg/pandan-coconut.webp",
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
  const product = { image: "/product.webp" };
  assert.equal(productOffer({ ...product, name: "Unavailable", priceSgd: undefined }, "https://swirlgirl.sg"), undefined);
  assert.equal(productOffer({ ...product, name: "Invalid", priceSgd: 0 }, "https://swirlgirl.sg"), undefined);
});

test("products without a usable image URL are omitted from product offers", () => {
  assert.equal(productOffer({ name: "Missing image", priceSgd: 18 }, "https://swirlgirl.sg"), undefined);
  assert.equal(productOffer({ name: "Invalid image", priceSgd: 18, image: "/product.webp" }), undefined);
});
