import test from "node:test";
import { LOADING_WORDS, LOADING_WORD_MS, LOADING_SEQUENCE_MS } from "../src/config/checkoutLoading.js";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { productionPayments } from "../src/paynowPayments.js";
import { issueTestPayment } from "../src/paynowTest.js";

test("checkout intro shows three words over three seconds", () => {
  assert.deepEqual(LOADING_WORDS, ["Swirling", "Girling", "Unfurling"]);
  assert.equal(LOADING_WORD_MS, 1000);
  assert.equal(LOADING_SEQUENCE_MS, 3000);
});

test("receipt offers Bun Bounce only after recording and WhatsApp handoff", async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
  try {
    const { default: OrderReceipt } = await server.ssrLoadModule("/src/components/OrderReceipt.jsx");
    const production = await productionPayments.issue({ ok: true, orderNumber: "SG-0123", amountDueSgd: 25.50 }, "fixture", undefined, [{ name: "Sourdough (loaf)", quantity: 1 }]);
    const render = (changes = {}, enabled = true, testMode = false, requestPending = false) => renderToStaticMarkup(React.createElement(OrderReceipt, {
      receipt: { status: "saved", orderNumber: production.orderNumber, paynow: production, amountDueSgd:25.5, whatsappOpened: true, message: "Test order", ...changes },
      brand: { name: "Swirl Girl", waNumberE164: "6581234567" },
      miniGameEnabled: enabled,
      testMode, requestPending,
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
    assert.match(render({}, true, true), /TEST order only/);
    const paynow = await issueTestPayment({ ok: true, orderNumber: "TEST-qr-render", amountDueSgd: 11.34 }, "test-secret", undefined, [{ name: "Banana Cake", quantity: 2 }]);
    const changes = { paynow, orderNumber: paynow.orderNumber, amountDueSgd: 11.34 };
    assert.match(render(changes, true, true), /Your payment QR is ready/);
    assert.match(render(changes, true, true), /Payment%20QR%20/);
    assert.doesNotMatch(render(changes), /Your payment QR is ready|Payment%20QR%20/);
    for (const status of ["pending", "delayed", "rejected", "unverified"]) assert.doesNotMatch(render({ ...changes, status }, true, true), /Your payment QR is ready|Payment%20QR%20/);
    const { default: PaynowPayment } = await server.ssrLoadModule("/src/components/PaynowPayment.jsx");
    const paymentHtml = renderToStaticMarkup(React.createElement(PaynowPayment, { payment: paynow, testMode: true }));
    assert.match(paymentHtml, /S\$11.34/);
    assert.match(paymentHtml, /sends real money/);
    assert.match(paymentHtml, /cannot confirm receipt of money/);
    assert.match(paymentHtml, /Save QR/);
    assert.match(paymentHtml, /Your order/);
    assert.match(paymentHtml, /Banana Cake/);
    assert.match(paymentHtml, /× 2/);
    assert.match(render({ status: "delayed", orderNumber: "" }, true, true), /WhatsApp waiting for QR link/);
    assert.doesNotMatch(render({ status: "delayed", orderNumber: "" }, true, true), />Send via WhatsApp</);
    assert.match(render({ status: "pending", orderNumber: "" }, true, true), /Saving your order and preparing its QR link/);
    const slowLive = render({ status: "delayed", orderNumber: "" }, true, true, true);
    assert.match(slowLive, />Swirling<\/span>/);
    assert.doesNotMatch(render(changes, true, true), />Swirling<\/span>/);
    assert.match(slowLive, /cinnamon-loader__rotor/);
    assert.match(slowLive, /Still waiting for your order reference/);
    assert.match(slowLive, /role="progressbar"[^>]*>[\s\S]*?receipt-bun-hop/);
    assert.doesNotMatch(render({ status: "unverified" }), /role="progressbar"/);
    assert.doesNotMatch(slowLive, />Send via WhatsApp</);
    for (const status of ["saved", "unverified", "rejected"]) assert.doesNotMatch(render({ status }, true, true, true), /cinnamon-loader__rotor/);
    assert.doesNotMatch(render({ status: "delayed" }, true, true, false), /cinnamon-loader__rotor/);
    assert.match(render({ status: "delayed" }, true, false, true), /cinnamon-loader__rotor/);
    for (const status of ["delayed", "unverified"]) {
      const fallback = render({ status, orderNumber: "", whatsappOpened: false, id: "123e4567-e89b-42d3-a456-426614174000" });
      assert.match(fallback, /WhatsApp waiting for QR link/);
      assert.doesNotMatch(fallback, /Send via WhatsApp/);
      assert.doesNotMatch(fallback, /https:\/\/wa.me|\?text=/);
      assert.match(fallback,/123e4567-e89b-42d3-a456-426614174000/);
    }
    const productionReceipt = render({ paynow: production, orderNumber: production.orderNumber, amountDueSgd: 25.50 });
    assert.match(productionReceipt, /Your payment QR is ready/);
    assert.doesNotMatch(productionReceipt, /TEST|Test order: paying/);
    const productionHtml = renderToStaticMarkup(React.createElement(PaynowPayment, { payment: production }));
    assert.match(productionHtml, /Sourdough \(loaf\)/);
    assert.match(productionHtml, /S\$25.50/);
    assert.match(productionHtml, /Wait for bakery confirmation/);
    assert.doesNotMatch(productionHtml, /TEST|Test checkout/);
    for (const changes of [{paynow:undefined},{amountDueSgd:0},{paynow:{...production,expiresAt:1}},{paynow:{...production,orderNumber:'SG-other'}}]) {
      const blocked=render({...changes,whatsappOpened:false});
      assert.doesNotMatch(blocked,/href="https:\/\/wa.me|>Send via WhatsApp</);
      assert.match(blocked,/WhatsApp waiting for QR link/);
    }
    const early=render({status:'delayed',orderNumber:'',paynow:undefined,whatsappOpened:false},true,false,true);
    assert.doesNotMatch(early,/href="https:\/\/wa.me/);
    assert.match(early,/cinnamon-loader__rotor/);
    assert.match(productionReceipt, /Payment%20QR%3A/);
    const rejected = render({ status: "rejected", orderNumber: "", whatsappOpened: false });
    assert.match(rejected, /This order was not recorded/);
    assert.doesNotMatch(rejected, /Send via WhatsApp|Simulate WhatsApp handoff/);
  } finally {
    await server.close();
  }
});
