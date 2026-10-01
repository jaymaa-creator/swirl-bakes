import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("receipt offers Bun Bounce only after recording and WhatsApp handoff", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { default: OrderReceipt } = await server.ssrLoadModule("/src/components/OrderReceipt.jsx");
    const render = (changes = {}, enabled = true, testMode = false) => renderToStaticMarkup(React.createElement(OrderReceipt, {
      receipt: { status: "saved", orderNumber: "SG-TEST", whatsappOpened: true, message: "Test order", ...changes },
      brand: { name: "Swirl Girl", waNumberE164: "6581234567" },
      miniGameEnabled: enabled,
      testMode,
    }));
    const html = render();
    assert.match(html, /href="\/minigame" target="_blank" rel="noopener noreferrer"/);
    assert.match(html, /Play Bun Bounce/);
    assert.match(html, /Awaiting bakery confirmation/);
    assert.match(html, /Open WhatsApp again/);
    assert.match(html, /cannot check whether your message was delivered/);
    for (const changes of [
      { whatsappOpened: false }, { status: "pending" }, { status: "delayed" },
      { status: "unverified" }, { orderNumber: "" },
    ]) assert.doesNotMatch(render(changes), /href="\/minigame"/);
    assert.doesNotMatch(render({}, false), /href="\/minigame"/);
    assert.doesNotMatch(render({}, true, true), /https:\/\/wa.me/);
    assert.match(render({}, true, true), /Simulate WhatsApp handoff/);
    const rejected = render({ status: "rejected", orderNumber: "", whatsappOpened: false });
    assert.match(rejected, /This order was not recorded/);
    assert.doesNotMatch(rejected, /Send via WhatsApp|Simulate WhatsApp handoff/);
  } finally {
    await server.close();
  }
});
