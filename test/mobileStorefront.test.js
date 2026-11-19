import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { mobileBakeCopy } from "../src/lib/mobileBakeCopy.js";

test("mobile copy follows future bakery edits", () => {
  assert.equal(mobileBakeCopy("A new seasonal filling."), "A new seasonal filling.");
  assert.equal(mobileBakeCopy("This banana cake is moist and buttery , with a bruled banana on top."),
    "Buttery banana cake topped with brûléed banana.");
});

test("mobile menu leads with the special, respects stock, and summarises only selected items", async () => {
  const server = await createServer({ cacheDir: "node_modules/.vite-mobile-storefront-test", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: "custom" });
  try {
    const { default: MenuSection } = await server.ssrLoadModule("/src/components/MenuSection.jsx");
    const { default: MobileOrderItems } = await server.ssrLoadModule("/src/components/MobileOrderItems.jsx");
    const menu = [
      { id: "sold", name: "Sold loaf", available: false },
      { id: "banana-bread", name: "Banana Cake", available: true, quantityLabel: "cake", special: true, priceSgd: 20 },
    ];
    const form = { items: { sold: 0, "banana-bread": 2 } };
    const props = { mobile: true, menu, form, menuStatus: "ready", batchLabel: "Sat, 21 Nov 2026", quantityOptions: [1, 2] };
    const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
    const markup = render(MenuSection, props);
    assert.ok(markup.indexOf('data-product-id="banana-bread"') < markup.indexOf('data-product-id="sold"'));
    assert.match(markup, /aria-label="Next bake"/);
    assert.match(markup, /aria-label="Add one cake of Banana Cake" disabled=""/);
    assert.doesNotMatch(markup, /Add one .* of Sold loaf/);
    assert.doesNotMatch(render(MenuSection, { ...props, mobile: false }), /weekly-bakes/);
    assert.match(render(MenuSection, { ...props, currentWeek: false }), /Upcoming bakes/);
    const summary = render(MobileOrderItems, { ...props, addOnTotal: 4 });
    assert.match(summary, /2 × Banana Cake/);
    assert.match(summary, /With chocolate chips/);
    assert.match(summary, /S\$44\.00/);
    assert.doesNotMatch(summary, /Sold loaf/);
  } finally {
    await server.close();
  }
});
