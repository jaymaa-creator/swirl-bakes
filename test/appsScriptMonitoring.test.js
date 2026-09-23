import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const BATCH = "2026-09-26";

function monitoringContext() {
  const properties = new Map([["ORDER_WEBHOOK_SECRET", "test-secret"]]);
  const emails = [];
  const context = vm.createContext({
    console: { log() {}, error() {} },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value),
      deleteProperty: (key) => properties.delete(key),
    }) },
    MailApp: { sendEmail: (email) => emails.push(email) },
    ScriptApp: { getProjectTriggers: () => [] },
    SpreadsheetApp: { openById: () => ({}) },
    UrlFetchApp: { fetch: () => { throw new Error("Unexpected fetch"); } },
  });
  vm.runInContext(source, context);
  return { context, properties, emails };
}

test("health alerts are deduplicated and a recovery email is sent", () => {
  const { context, emails } = monitoringContext();
  context.updateProductionHealthAlert(["Menu is unavailable."]);
  context.updateProductionHealthAlert(["Menu is unavailable."]);
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /ALERT/);
  assert.equal(emails[0].to, "jaemcd95@gmail.com");

  context.updateProductionHealthAlert([]);
  context.updateProductionHealthAlert([]);
  assert.equal(emails.length, 2);
  assert.match(emails[1].subject, /RECOVERED/);
});

test("each persisted Worker failure event is emailed only once", () => {
  const { context, emails } = monitoringContext();
  const event = { orderRelay: { at: "2026-09-22T08:01:00.000Z", message: "relay failed" } };
  context.notifyNewWorkerEvents(event);
  context.notifyNewWorkerEvents(event);
  assert.equal(emails.length, 1);
  assert.match(emails[0].body, /orderRelay: relay failed/);

  context.notifyNewWorkerEvents({ orderRelay: { at: "2026-09-22T09:01:00.000Z", message: "relay failed again" } });
  assert.equal(emails.length, 2);
});

function response(status, body) {
  return { getResponseCode: () => status, getContentText: () => body };
}

test("production check compares the live menu and calendar with fresh Sheet data", () => {
  const { context } = monitoringContext();
  const product = {
    id: "cinnamon-rolls", productName: "Cinnamon Rolls", available: true, special: false,
    priceSgd: 35, maxQuantity: 3, batchLimit: 6, remainingQuantity: 5, soldQuantity: 1,
    description: "Fresh", allergens: "Gluten", per: "per box", imageUrl: "/rolls.webp",
  };
  const calendar = [{ date: BATCH, open: true }];
  context.UrlFetchApp.fetch = (url) => {
    if (url.endsWith("/api/menu")) return response(200, JSON.stringify({ ok: true, batchKey: BATCH, products: [product], calendar }));
    if (url.endsWith("/api/monitor")) return response(200, JSON.stringify({ ok: true, currentBatch: BATCH, events: {} }));
    return response(200, "<html>ok</html>");
  };
  Object.assign(context, {
    readBakeCalendar: () => calendar,
    getMenuBatchDate: () => new Date(`${BATCH}T00:00:00+08:00`),
    formatBatchKey: () => BATCH,
    readMenuSettings: () => [product],
  });
  assert.equal(context.collectProductionHealthStatus().failures.length, 0);

  context.readMenuSettings = () => [{ ...product, priceSgd: 36, soldQuantity: 7 }];
  const failures = context.collectProductionHealthStatus().failures;
  assert.equal(failures.some((failure) => failure.includes("does not match Google Sheets")), true);
  assert.equal(failures.some((failure) => failure.includes("oversold by 1")), true);
});

test("setup installs one 15-minute trigger and sends a confirmation email", () => {
  const { context, emails } = monitoringContext();
  const trigger = { timeBased: false, minutes: 0 };
  context.ScriptApp.getProjectTriggers = () => [];
  context.ScriptApp.newTrigger = (handler) => {
    assert.equal(handler, "runProductionHealthCheck");
    return {
      timeBased() { trigger.timeBased = true; return this; },
      everyMinutes(minutes) { trigger.minutes = minutes; return this; },
      create() { trigger.created = true; return this; },
    };
  };
  context.runProductionHealthCheck = () => ({ ok: true, failures: [] });
  assert.equal(context.setupProductionMonitoring().ok, true);
  assert.deepEqual(trigger, { timeBased: true, minutes: 15, created: true });
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /monitoring enabled/i);
});
