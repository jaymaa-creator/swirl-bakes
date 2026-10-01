import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'espree';
import { pathToFileURL } from 'node:url';

export const TEST_SCRIPT_ID = '1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9';
export const TEST_SHEET_ID = '1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc';
export const TEST_ENDPOINT = 'https://test-swirl-girl.jaemcd95.workers.dev/api/test/menu/sync';

// Generate the isolated variant from the shared implementation, never edit production.
export function buildTestScript(source) {
  const ast = parse(source, { ecmaVersion: 'latest', range: true, tokens: true });
  const functions = ast.body.filter((node) => node.type === 'FunctionDeclaration');
  const names = new Set(functions.map((node) => node.id.name));
  const overrides = {
    setupProductionMonitoring: 'throw new Error("Monitoring is disabled in TEST");',
    runProductionHealthCheck: 'throw new Error("Monitoring is disabled in TEST");',
    sendMonitoringEmail: 'return { ok: false, disabled: true };',
    getNextOrderNumber: 'return "TEST-" + Utilities.getUuid();',
    publishMenuSnapshot: `
      const secret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY);
      if (!secret) throw new Error("Missing TEST_ORDER_WEBHOOK_SECRET");
      const spreadsheet = TEST_openSpreadsheet(SPREADSHEET_ID);
      const calendar = TEST_readBakeCalendar(spreadsheet);
      const batch = TEST_formatBatchKey(TEST_getMenuBatchDate("", spreadsheet, calendar));
      const keys = TEST_getSnapshotBatchKeys(calendar, batch);
      const snapshots = TEST_buildMenuSnapshots(keys, batch, calendar, spreadsheet, true);
      return TEST_publishSnapshotToEndpoint(${JSON.stringify(TEST_ENDPOINT)},
        { secret, currentBatch: batch, snapshots }, "test");`,
  };
  const edits = [];
  const replaced = functions.filter((node) => overrides[node.id.name]);
  for (const node of replaced) edits.push([node.body.range[0] + 1, node.body.range[1] - 1,
    '\n TEST_assertProject();\n ' + overrides[node.id.name] + '\n']);
  for (const token of ast.tokens) {
    if (replaced.some((node) => token.range[0] > node.body.range[0] && token.range[1] < node.body.range[1])) continue;
    if (token.type === 'Identifier' && names.has(token.value)) {
      edits.push([...token.range, 'TEST_' + token.value]);
    } else if (token.type === 'String') {
      const value = source.slice(...token.range).slice(1, -1);
      const replacement = names.has(value) ? 'TEST_' + value : {
        '12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A': TEST_SHEET_ID,
        'ORDER_WEBHOOK_SECRET': 'TEST_ORDER_WEBHOOK_SECRET',
        'https://swirlgirl.sg': 'https://test-swirl-girl.jaemcd95.workers.dev',
      }[value];
      if (replacement) edits.push([...token.range, JSON.stringify(replacement)]);
    }
  }
  for (const node of functions.filter((node) => !overrides[node.id.name])) {
    const guard = node.id.name === 'doPost' ? '\n TEST_assertRequest(event);' : '';
    edits.push([node.body.range[0] + 1, node.body.range[0] + 1, '\n TEST_assertProject();' + guard]);
  }
  let output = source;
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) output = output.slice(0, start) + value + output.slice(end);
  output = output.replaceAll('SpreadsheetApp.openById(', 'TEST_openSpreadsheet(')
    .replaceAll('UrlFetchApp.fetch(', 'TEST_fetch(');
  // Test availability must govern both menu reads and authoritative order checks.
  output = output.replace('function TEST_readMenuSettings(forceRefresh, batchKey, spreadsheet, calendar, useTestAvailability) {',
    'function TEST_readMenuSettings(forceRefresh, batchKey, spreadsheet, calendar, useTestAvailability) {\n useTestAvailability = true;');
  output += `
// Google requires these two public entry-point names.
function doGet(event) { return TEST_doGet(event); }
function doPost(event) {
  try {
    TEST_assertRequest(event);
    const payload = JSON.parse(event.postData.contents);
    if (payload.action === "testBackendInfo") return TEST_jsonResponse(TEST_checkIsolation());
    return TEST_doPost(event);
  } catch (error) {
    return TEST_jsonResponse({ ok: false, error: "Test request refused" });
  }
}
function TEST_assertRequest(event) {
  TEST_assertProject();
  const payload = JSON.parse(event && event.postData && event.postData.contents || "{}");
  const secret = PropertiesService.getScriptProperties().getProperty("TEST_ORDER_WEBHOOK_SECRET");
  if (!secret || payload.secret !== secret || payload.environment !== "test") throw new Error("Unauthorized test request");
}
function TEST_assertProject() {
  if (ScriptApp.getScriptId() !== ${JSON.stringify(TEST_SCRIPT_ID)}) throw new Error("Wrong Apps Script project: TEST only");
}
function TEST_openSpreadsheet(id) {
  TEST_assertProject();
  if (id !== ${JSON.stringify(TEST_SHEET_ID)}) throw new Error("Wrong spreadsheet: TEST only");
  return SpreadsheetApp.openById(id);
}
function TEST_fetch(url, options) {
  TEST_assertProject();
  if (url !== ${JSON.stringify(TEST_ENDPOINT)}) throw new Error("Endpoint refused: TEST menu sync only");
  return UrlFetchApp.fetch(url, { ...options, followRedirects: false });
}
function TEST_checkIsolation() {
  TEST_assertProject();
  const sheet = TEST_openSpreadsheet(SPREADSHEET_ID);
  return { ok: true, scriptId: ScriptApp.getScriptId(), spreadsheetId: sheet.getId(), orderWritesEnabled: true };
}
function TEST_inspectSetup() {
  TEST_assertProject();
  const sheet = TEST_openSpreadsheet(SPREADSHEET_ID);
  const orders = sheet.getSheetByName("Orders");
  const properties = PropertiesService.getScriptProperties();
  const report = {
    spreadsheetId: sheet.getId(),
    ordersSheetPresent: Boolean(orders),
    copiedRecordsRetained: true,
    orderWritesEnabled: true,
    monitoringEmailsEnabled: false,
    testSecretConfigured: Boolean(properties.getProperty("TEST_ORDER_WEBHOOK_SECRET")),
    triggers: ScriptApp.getProjectTriggers().map(function(trigger) {
      return trigger.getHandlerFunction();
    })
  };
  console.log(JSON.stringify(report));
  return report;
}
`;
  if (output.includes('12YlQLXoM4yjy9dfZExeAQhEM-QMZZn_TyzbmHLN3L2A') || output.includes('https://swirlgirl.sg')) throw new Error('Production target remains');
  parse(output, { ecmaVersion: 'latest' });
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../', import.meta.url);
  const config = JSON.parse(await readFile(new URL('.clasp.test.json', root), 'utf8'));
  if (config.scriptId !== TEST_SCRIPT_ID || config.rootDir !== 'apps-script-test') throw new Error('Wrong TEST clasp target');
  const source = await readFile(new URL('apps-script/Code.gs', root), 'utf8');
  await mkdir(new URL('apps-script-test/', root), { recursive: true });
  await writeFile(new URL('apps-script-test/Code.gs', root), buildTestScript(source));
  const manifest = JSON.parse(await readFile(new URL('apps-script/appsscript.json', root), 'utf8'));
  // Worker-to-script POSTs require the independent secret and test environment marker.
  manifest.webapp.access = 'ANYONE_ANONYMOUS';
  await writeFile(new URL('apps-script-test/appsscript.json', root), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Built isolated TEST Apps Script; authenticated test orders only, monitoring disabled.');
}
