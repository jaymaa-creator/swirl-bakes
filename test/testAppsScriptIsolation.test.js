import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildTestScript, TEST_SCRIPT_ID, TEST_SHEET_ID, TEST_ENDPOINT } from '../scripts/build-test-apps-script.mjs';

const source = buildTestScript(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'));
function harness(scriptId = TEST_SCRIPT_ID) {
  const calls = [];
  const context = vm.createContext({
    ScriptApp: { getScriptId: () => scriptId },
    SpreadsheetApp: { openById: (id) => { calls.push(id); return { getId: () => id }; } },
    UrlFetchApp: { fetch: (url, options) => { calls.push({ url, options }); return {}; } },
  });
  vm.runInContext(source, context);
  return { context, calls };
}
test('all generated custom functions and trigger handlers use TEST prefix', () => {
  for (const match of source.matchAll(/^function (\w+)/gm)) assert.ok(match[1].startsWith('TEST_') || ['doGet', 'doPost'].includes(match[1]));
  assert.match(source, /newTrigger\("TEST_onMenuSheetEdit"\)/);
  assert.match(source, /"TEST_publishQueuedMenuSnapshot"/);
  assert.doesNotMatch(source, /https:\/\/swirlgirl\.sg|12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A|MailApp.sendEmail/);
});
test('test spreadsheet and project guards reject production before service calls', () => {
  const { context, calls } = harness();
  assert.equal(context.TEST_checkIsolation().spreadsheetId, TEST_SHEET_ID);
  assert.throws(() => context.TEST_openSpreadsheet('production'), /Wrong spreadsheet/);
  assert.equal(calls.length, 1);
  const wrong = harness('production');
  assert.throws(() => wrong.context.TEST_checkIsolation(), /Wrong Apps Script/);
  assert.equal(wrong.calls.length, 0);
});
test('network allowlist rejects production and disables redirects', () => {
  const { context, calls } = harness();
  assert.throws(() => context.TEST_fetch('https://swirlgirl.sg/api/menu/sync', {}), /Endpoint refused/);
  assert.throws(() => context.TEST_fetch(TEST_ENDPOINT + '.evil', {}), /Endpoint refused/);
  context.TEST_fetch(TEST_ENDPOINT, { followRedirects: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.followRedirects, false);
});
test('unauthenticated orders are refused and monitoring stays disabled', () => {
  const { context, calls } = harness();
  context.TEST_jsonResponse = (value) => value;
  assert.equal(context.doPost({}).ok, false);
  assert.throws(() => context.TEST_setupProductionMonitoring(), /disabled/);
  assert.equal(context.TEST_sendMonitoringEmail().disabled, true);
  assert.equal(calls.length, 0);
});

test('test order references never reuse copied production numbering', () => {
  const { context } = harness();
  let sequence = 0;
  context.Utilities = { getUuid: () => `uuid-${++sequence}` };
  assert.equal(context.TEST_getNextOrderNumber(), 'TEST-uuid-1');
  assert.equal(context.TEST_getNextOrderNumber(), 'TEST-uuid-2');
});

test('setup inspection does not write data or print secrets and customer records', () => {
  const { context } = harness();
  const logs = [];
  context.console = { log: (line) => logs.push(line) };
  context.SpreadsheetApp.openById = () => ({ getId: () => TEST_SHEET_ID, getSheetByName: () => ({}) });
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'secret-must-not-appear' }) };
  context.ScriptApp.getProjectTriggers = () => [{ getHandlerFunction: () => 'TEST_onMenuSheetEdit' }];
  const report = context.TEST_inspectSetup();
  assert.equal(report.testSecretConfigured, true);
  assert.equal(report.orderWritesEnabled, true);
  assert.match(logs[0], /TEST_onMenuSheetEdit/);
  assert.doesNotMatch(logs[0], /secret-must-not-appear/);
});
