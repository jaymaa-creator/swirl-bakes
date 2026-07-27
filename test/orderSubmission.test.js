import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderRecord } from "../src/lib/orderSubmission.js";

const menu = [
  { id: "rolls", name: "Cinnamon Rolls" },
  { id: "bread", name: "Banana Bread" },
];

test("buildOrderRecord includes a self-collection slot and excludes an address", () => {
  const order = buildOrderRecord({
    form: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: "Sat, 8 Mar 2026",
      items: { rolls: 2, bread: 0 },
      delivery: "Self-collection - agreed pickup point",
      pickupTime: "Morning",
      address: "123 Test Street",
      notes: "No nuts",
    },
    menu,
    estimatedTotal: 10,
    moneyFormatter: (amount) => `S$${amount}`,
  });

  assert.equal(order.items, "Cinnamon Rolls x2");
  assert.equal(order.pickupTime, "Morning");
  assert.equal(order.address, "");
});

test("buildOrderRecord includes a delivery address and excludes collection slot", () => {
  const order = buildOrderRecord({
    form: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: "Sat, 8 Mar 2026",
      items: { rolls: 0, bread: 2 },
      delivery: "Delivery (GrabExpress / Lalamove) - paid by customer",
      pickupTime: "Afternoon",
      address: "123 Test Street",
      notes: "",
    },
    menu,
    estimatedTotal: 4,
    moneyFormatter: (amount) => `S$${amount}`,
  });

  assert.equal(order.items, "Banana Bread x2");
  assert.equal(order.pickupTime, "");
  assert.equal(order.address, "123 Test Street");
});
