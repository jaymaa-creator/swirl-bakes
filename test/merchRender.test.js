import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("Merch renders separate add-on controls, a S$10 price, and clear sold-out copy", async () => {
  const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { default: MenuSection } = await server.ssrLoadModule("/src/components/MenuSection.jsx");
    const render = (hasSelectedBakes, available = true) => renderToStaticMarkup(React.createElement(MenuSection, {
      merch: true, hasSelectedBakes, menuStatus: "ready", form: { items: {} }, setForm() {},
      quantityOptions: [1, 2, 3], menu: [{ id: "tote-bag", name: "Tote bag", kind: "merch", priceSgd: 10,
        available, remainingQuantity: available ? 10 : 0, quantityOptions: available ? [1, 2, 3] : [],
        quantityLabel: "bag", quantityLabelPlural: "bags" }],
    }));
    const noBakes = render(false);
    assert.match(noBakes, /id="merch"/);
    assert.match(noBakes, /S\$10\.00/);
    assert.match(noBakes, /Photo coming soon/);
    assert.match(noBakes, /Choose your bakes first/);
    assert.equal((noBakes.match(/disabled=""/g) || []).length, 3);
    const withBakes = render(true);
    assert.doesNotMatch(withBakes, /disabled=""/);
    assert.match(withBakes, /10 available/);
    const soldOut = render(true, false);
    assert.match(soldOut, /Sold out/);
    assert.doesNotMatch(soldOut, /Sold out for this bake|Order for/);
  } finally {
    await server.close();
  }
});
