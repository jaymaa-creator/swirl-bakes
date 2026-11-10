import { validReportDate } from './reports.js';
import { readLimited } from './photos.js';
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
const errors = {
  ORDERS_SCHEMA: 'The Orders sheet needs checking before this dashboard can load.',
  ORDERS_LIMIT: 'Too many orders to display safely. Please use the Sheet for this bake.',
  ORDER_CONFLICT: 'This order has changed or has a duplicate reference. Refresh before updating it.',
  ORDERS_DATE: 'Choose a valid bake date.',
  ORDER_UPDATE_UNVERIFIED: 'The update could not be confirmed. Refresh to check the Sheet before trying again.',
};
const validText = (value, max) => typeof value === 'string' && value.length <= max;
export function validateBakeOrders(data, environment) {
  if (data.source !== `${environment}-orders` || !validText(data.batch, 10) || !validReportDate(data.batch)
      || !Array.isArray(data.bakeDates) || data.bakeDates.length > 2400 || data.bakeDates.some(d => !d || !validReportDate(d))
      || !Array.isArray(data.orders) || data.orders.length > 500 || !Number.isFinite(Date.parse(data.refreshedAt))) throw new Error('Invalid response');
  const quality = {};
  for (const key of ['invalidDate', 'duplicates', 'missingReference', 'invalidAmount', 'invalidItems']) {
    if (!Number.isSafeInteger(data.quality?.[key]) || data.quality[key] < 0) throw new Error('Invalid quality');
    quality[key] = data.quality[key];
  }
  const orders = data.orders.map(row => {
    const result = {};
    for (const [key, limit] of Object.entries({ orderNumber: 80, batch: 10, name: 200, phone: 15, itemsText: 6000, status: 100, fulfilment: 200, collectionSlot: 100, address: 2000, notes: 4000, revision: 64 })) {
      if (!validText(row[key], limit)) throw new Error('Invalid order');
      result[key] = row[key];
    }
    if (row.batch !== data.batch || !/^[a-f0-9]{64}$/.test(row.revision) || (row.phone && !/^\d{10,15}$/.test(row.phone))) throw new Error('Invalid identity');
    for (const key of ['paid', 'completed', 'cancelled', 'duplicate', 'editable']) {
      if (typeof row[key] !== 'boolean') throw new Error('Invalid state');
      result[key] = row[key];
    }
    if (row.amountCents !== null && (!Number.isSafeInteger(row.amountCents) || row.amountCents < 0 || row.amountCents > 100000000)) throw new Error('Invalid amount');
    result.amountCents = row.amountCents;
    if (!Array.isArray(row.items) || row.items.length > 50) throw new Error('Invalid items');
    result.items = row.items.map(item => {
      if (!validText(item.name, 200) || !item.name.trim() || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) throw new Error('Invalid item');
      return { name: item.name, quantity: item.quantity };
    });
    result.editable = result.editable && /^[A-Za-z0-9-]{1,80}$/.test(result.orderNumber) && !result.cancelled && !result.duplicate && result.amountCents !== null && result.items.length > 0;
    return result;
  });
  return { batch: data.batch, bakeDates: data.bakeDates, orders, quality, source: data.source, refreshedAt: new Date(data.refreshedAt).toISOString() };
}
export async function handleBakeOrders(request, env) {
  const url = new URL(request.url);
  const environment = url.origin === 'https://test-swirl-girl.jaemcd95.workers.dev' && env.ISOLATED_TEST_BACKEND === true ? 'test'
    : url.origin === 'https://swirlgirl.sg' && !env.ISOLATED_TEST_BACKEND ? 'production' : null;
  if (!environment || !env.ORDER_WEBHOOK_SECRET || !env.ORDER_SHEET_WEBHOOK_URL) return reply({ error: 'Orders are not configured for this site.' }, 503);
  if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
  let command;
  if (request.method === 'GET') {
    const batch = url.searchParams.get('batch') || '';
    if (!validReportDate(batch)) return reply({ error: errors.ORDERS_DATE }, 400);
    command = { action: 'adminBakeOrders', batch };
  } else {
    if (request.headers.get('Origin') !== url.origin) return reply({ error: 'Invalid origin' }, 403);
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return reply({ error: 'JSON required' }, 415);
    let bytes;
    try { bytes = await readLimited(request, 2000); } catch { return reply({ error: 'Request too large or empty' }, 413); }
    try {
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!['paid', 'completed'].includes(data.change) || !validText(data.orderNumber, 80) || !/^[A-Za-z0-9-]{1,80}$/.test(data.orderNumber)
          || !validText(data.batch, 10) || !data.batch || !validReportDate(data.batch) || !/^[a-f0-9]{64}$/.test(data.revision)) throw new Error();
      command = { action: 'adminUpdateBakeOrder', orderNumber: data.orderNumber, batch: data.batch, revision: data.revision, change: data.change };
    } catch { return reply({ error: 'Invalid order update' }, 400); }
  }
  try {
    const response = await fetch(env.ORDER_SHEET_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ ...command, environment, secret: env.ORDER_WEBHOOK_SECRET }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true) return reply({ error: errors[data.errorCode] || (request.method === 'POST' ? errors.ORDER_UPDATE_UNVERIFIED : 'Unable to load orders. Please refresh.') }, data.errorCode === 'ORDER_CONFLICT' ? 409 : 503);
    if (request.method === 'POST') {
      if (data.saved !== true || typeof data.referralDeferred !== 'boolean') throw new Error('Unverified update');
      return reply({ ok: true, referralDeferred: data.referralDeferred });
    }
    return reply(validateBakeOrders(data, environment));
  } catch { return reply({ error: request.method === 'POST' ? errors.ORDER_UPDATE_UNVERIFIED : 'Unable to load orders. Please refresh.' }, 503); }
}
