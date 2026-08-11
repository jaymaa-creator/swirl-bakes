import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderMessage, buildWhatsAppLink } from "../src/lib/orderMessaging.js";

const menu = [
  { id: "classic", name: "Classic Roll" },
  { id: "pecan", name: "Pecan Roll" },
];

test("buildWhatsAppLink strips non-digits and URL-encodes message", () => {
  const link = buildWhatsAppLink("+65 8123 4567", "Hello there");
  assert.equal(link, "https://wa.me/6581234567?text=Hello%20there");
});

test("buildOrderMessage includes selected items and delivery address", () => {
  const form = {
    name: "Jamie",
    phone: "+65 8123 4567",
    bakeWindow: "Sat, 8 Mar 2026",
    delivery: "Delivery (GrabExpress / Lalamove) - paid by customer",
    area: "Central",
    address: "123 Test St #01-02",
    notes: "No nuts",
    items: { classic: 2, pecan: 0 },
  };

  const message = buildOrderMessage({
    brandName: "Swirl Girl Bakes",
    form,
    menu,
    estimatedTotal: 28,
    moneyFormatter: (n) => `S$${n}`,
  });

  assert.match(message, /Swirl Girl Bakes Saturday reservation/);
  assert.match(message, /- Classic Roll x2/);
  assert.doesNotMatch(message, /- Pecan Roll x0/);
  assert.match(message, /Address: 123 Test St #01-02/);
  assert.match(message, /Estimated total: S\$28/);
});

test("buildOrderMessage includes an order reference when supplied", () => {
  const message = buildOrderMessage({
    brandName: "Swirl Girl Bakes",
    form: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: "Sat, 8 Mar 2026",
      delivery: "Self-collection - agreed pickup point",
      pickupTime: "Morning",
      items: { classic: 1, pecan: 0 },
    },
    menu,
    estimatedTotal: 35,
    moneyFormatter: (n) => `S$${n}`,
    orderNumber: "SG-0001",
  });

  assert.match(message, /Order reference: SG-0001/);
});

test("buildOrderMessage includes the flat delivery fee in an eligible delivery order", () => {
  const message = buildOrderMessage({
    brandName: "Swirl Girl",
    form: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: "Sat, 8 Mar 2026",
      delivery: "Delivery - flat S$8 fee",
      address: "123 Test St #01-02",
      items: { classic: 2, pecan: 0 },
    },
    menu,
    itemsTotal: 50,
    deliveryFee: 8,
    estimatedTotal: 55,
    moneyFormatter: (n) => `S$${n}`,
  });

  assert.match(message, /Items subtotal: S\$50/);
  assert.match(message, /Delivery fee: S\$8/);
  assert.match(message, /Estimated total: S\$55/);
});

test("buildOrderMessage includes the collection readiness note instead of an address", () => {
  const form = {
    name: "Jamie",
    phone: "+65 8123 4567",
    bakeWindow: "Sat, 8 Mar 2026",
    delivery: "Self-collection - agreed pickup point",
    pickupTime: "Ready to collect from 11am",
    address: "",
    items: { classic: 2, pecan: 0 },
  };

  const message = buildOrderMessage({
    brandName: "Swirl Girl Bakes",
    form,
    menu,
    estimatedTotal: 14,
    moneyFormatter: (n) => `S$${n}`,
  });

  assert.match(message, /Collection: Ready to collect from 11am/);
  assert.doesNotMatch(message, /Address:/);
});
