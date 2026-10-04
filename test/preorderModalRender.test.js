import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("checkout provides inline consent and actionable footer instead of a disabled button", async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { default: PreorderModal } = await server.ssrLoadModule("/src/components/PreorderModal.jsx");
    const render = (changes = {}) => renderToStaticMarkup(React.createElement(PreorderModal, {
      open: true, onClose() {}, setForm() {}, onRetryMenu() {},
      form: { name: "", phone: "", delivery: "Self-collection", pickupTime: "11am-12pm", address: "", notes: "", items: {} },
      estimatedTotal: 0, itemsTotal: 0, addOnTotal: 0, deliveryFee: 0,
      isDeliveryEligible: false, waMessage: "Test order", bakeWindowLabel: "Test batch",
      hasSelectedItems: false, hasCurrentPrices: true, canSubmitOrder: false,
      isBakeWindowOpen: true, menuStatus: "ready", menu: [], quantityOptions: [1, 2],
      allergenDisclaimer: "Test allergen notice: cross-contamination is possible.", money: n => `S$${n}`,
      brand: { deliveryOptions: ["Delivery", "Self-collection"], deliveryFeeSgd: 15, deliveryMinimumSgd: 30, pickupWindows: ["11am-12pm"], orderCutoffLabel: "Thursday" },
      ...changes,
    }));
    const html = render();
    assert.match(html, /To continue: Enter your name/);
    const checkoutButton = html.match(/<button[^>]*aria-describedby="checkout-guidance"[^>]*>/)?.[0];
    assert.ok(checkoutButton);
    assert.doesNotMatch(checkoutButton, /disabled/);
    assert.match(html, /id="order-allergens" type="checkbox" required/);
    assert.match(html, /Test allergen notice: cross-contamination is possible/);
    assert.equal((html.match(/role="dialog"/g) || []).length, 1);
    assert.doesNotMatch(html, /Please read…|I understand, continue|I confirm I have read/);
    assert.match(render({ menuStatus: "error" }), /Retry menu/);
    assert.match(render({ menuStatus: "loading" }), /menu and prices are loading/);
    assert.equal(render({ open: false }), "");
  } finally { await server.close(); }
});
