import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderRecord } from "../src/lib/orderSubmission.js";

const menu = [
  { id: "rolls", name: "Cinnamon Rolls" },
  { id: "bread", name: "Banana Cake" },
];

test("buildOrderRecord includes the collection readiness note and excludes an address", () => {
  const order = buildOrderRecord({
    form: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: "Sat, 8 Mar 2026",
      items: { rolls: 2, bread: 0 },
      delivery: "Self-collection - agreed pickup point",
      pickupTime: "Ready to collect from 11am",
      address: "123 Test Street",
      notes: "No nuts",
    },
    menu,
    estimatedTotal: 10,
    moneyFormatter: (amount) => `S$${amount}`,
  });

  assert.equal(order.items, "Cinnamon Rolls x2");
  assert.deepEqual(order.lineItems, [{ productId: "rolls", quantity: 2 }]);
  assert.equal(order.quotedTotalSgd, 10);
  assert.equal(order.pickupTime, "Ready to collect from 11am");
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

  assert.equal(order.items, "Banana Cake x2");
  assert.deepEqual(order.lineItems, [{ productId: "bread", quantity: 2 }]);
  assert.equal(order.pickupTime, "");
  assert.equal(order.address, "123 Test Street");
});

test("buildOrderRecord saves the Banana Cake chocolate-chip add-on", () => {
  const order = buildOrderRecord({
    form: {
      name: "Jamie",
      phone: "+65 8123 4567",
      bakeWindow: "Sat, 8 Mar 2026",
      items: { rolls: 0, bread: 0, "banana-bread": 2 },
      bananaChocolateChips: true,
      delivery: "Self-collection - agreed pickup point",
      pickupTime: "1pm-2pm",
      address: "",
      notes: "",
    },
    menu: [{ id: "banana-bread", name: "Banana Cake" }],
    estimatedTotal: 44,
    moneyFormatter: (amount) => `S$${amount}`,
  });

  assert.match(order.items, /Chocolate chips for Banana Cake x2 \(\+S\$4\)/);
  assert.equal(order.bananaChocolateChips, true);
  assert.equal(order.pickupTime, "1pm-2pm");
});
