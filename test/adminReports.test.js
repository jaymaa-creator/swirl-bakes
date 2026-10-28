import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handleReports } from '../src/admin/reports.js';
const ctx = vm.createContext({ Date, console, Utilities: { formatDate: date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) } });
vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);
const headers = ['Order No', 'Created At', 'Amount Due', 'Paid?', 'Status', 'Customer Key', 'Phone', 'Total'];
const run = (rows, from = '', to = '') => JSON.parse(JSON.stringify(ctx.buildAdminSalesReport(headers, rows, from, to)));

test('sales metrics distinguish paid/reserved/cancelled and count customers across exact key/phone history', () => {
  const report = run([
    ['old', '2026-09-01', 10, true, '', '', '91234567'],
    ['one', '2026-10-01', 20, true, '', 'key-a', '+65 9123 4567'],
    ['two', '2026-10-02', 30, false, 'Paid', 'key-a', ''],
    ['three', '2026-10-03', 15, true, '', 'key-b', '98765432'],
    ['four', '2026-10-04', 8, false, 'New', 'key-b', ''],
    ['cancel', '2026-10-04', 200, true, 'Cancelled', 'key-c', ''],
    ['refund', '2026-10-04', 100, true, 'Refunded', 'key-d', ''],
    ['unknown', '2026-10-04', 5, true, '', '', ''],
  ], '2026-10-01', '2026-10-31');
  assert.deepEqual(report.metrics, { paidCents: 7000, paidOrders: 4, unpaidCents: 800, unpaidOrders: 1, uniqueCustomers: 2, averageOrderCents: 1750, averageCustomerCents: 3250, identifiedPaidOrders: 3, repeatCustomers: 1, returningCustomers: 1 });
  assert.equal(report.quality.missingIdentity, 1); assert.equal(report.quality.excludedStatus, 2);
  assert.equal(report.months[0].paidCents, 7000);
  assert.ok(!JSON.stringify(report).includes('91234567'));
  assert.ok(!JSON.stringify(report).includes('key-a'));
});

test('deduplication, invalid dates/amounts and amount_due priority do not silently inflate figures', () => {
  const report = run([
    ['a', '2026-10-01', 12, true, '', 'x', '', 50],
    ['a', '2026-10-01', 12, true, '', 'x'],
    ['b', '2026-10-02', '', true, '', 'y', '', 'S$1,200.50'],
    ['c', '2026-02-30', 100, true],
    ['d', '2026-10-02', 'oops', true],
    ['', '2026-10-03', 0, true, '', '', ''],
  ]);
  assert.equal(report.metrics.paidCents, 121250); assert.equal(report.metrics.paidOrders, 3);
  assert.equal(report.quality.invalidDate, 1); assert.equal(report.quality.invalidAmount, 1);
  assert.equal(report.quality.duplicates, 1); assert.equal(report.quality.missingReference, 1);
});

test('Singapore day boundaries, empty averages and exact phone parsing', () => {
  const report = run([['a', new Date('2026-09-30T16:01:00Z'), 20, true, '', '', '+6591234567']], '2026-10-01', '2026-10-01');
  assert.equal(report.metrics.paidOrders, 1);
  const empty = run([['', '', '', false, 'New', '', '', '']], '2026-10-01', '2026-10-31');
  assert.equal(empty.quality.invalidDate, 0);
  assert.equal(empty.metrics.averageOrderCents, null); assert.equal(empty.metrics.averageCustomerCents, null);
  assert.equal(ctx.adminReportPhone('https://wa.me/6591234567'), '6591234567');
  assert.equal(ctx.adminReportPhone('Jane 91234567'), '');
  assert.equal(ctx.adminReportPhone('91234567'), '6591234567');
  assert.equal(ctx.adminReportMoney('S$-20'), null);
  assert.equal(ctx.adminReportMoney('1,2'), null);
});

test('reports API validates dates, uses test secret and strips unexpected backend fields', async () => {
  const env = { ISOLATED_TEST_BACKEND: true, ORDER_WEBHOOK_SECRET: 'test-only', ORDER_SHEET_WEBHOOK_URL: 'https://script.google.com/test' };
  const host = 'https://test-swirl-girl.jaemcd95.workers.dev/api/admin/reports';
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, env.ORDER_SHEET_WEBHOOK_URL);
    assert.equal(JSON.parse(options.body).secret, 'test-only'); assert.equal(JSON.parse(options.body).environment, 'test');
    return Response.json({ ...run([]), refreshedAt: '2026-10-26T00:00:00Z', phone: 'private', rows: ['private'] });
  };
  try {
    assert.equal((await handleReports(new Request(host, { method: 'POST' }), env)).status, 405);
    assert.equal((await handleReports(new Request(host), {})).status, 503);
    assert.equal((await handleReports(new Request(host + '?from=2026-02-30'), env)).status, 400);
    assert.equal((await handleReports(new Request(host + '?from=2026-11-01&to=2026-10-01'), env)).status, 400);
    assert.equal(calls, 0);
    const response = await handleReports(new Request(host), env);
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.ok(!(await response.text()).includes('private')); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
