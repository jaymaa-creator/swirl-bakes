const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
export function validReportDate(text) {
  if (!text) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(text + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
}
export async function handleReports(request, env) {
  if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);
  if (new URL(request.url).hostname !== 'test-swirl-girl.jaemcd95.workers.dev' || !env.ISOLATED_TEST_BACKEND || !env.ORDER_WEBHOOK_SECRET || !env.ORDER_SHEET_WEBHOOK_URL) return reply({ error: 'Reports are available on the configured test site only.' }, 503);
  const params = new URL(request.url).searchParams;
  const from = params.get('from') || '', to = params.get('to') || '';
  if (!validReportDate(from) || !validReportDate(to) || (from && to && from > to)) return reply({ error: 'Choose a valid date range, with the start before the end.' }, 400);
  try {
    const response = await fetch(env.ORDER_SHEET_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ action: 'adminSalesReport', environment: 'test', secret: env.ORDER_WEBHOOK_SECRET, from, to }) });
    const data = await response.json();
    if (!response.ok || data.ok !== true) {
      const errors = { REPORT_SCHEMA: 'The Orders sheet is missing a usable date, amount or payment-status column. Check its headers and refresh.', REPORT_LIMIT: 'This pilot supports up to 10,000 order rows. A larger reporting store is needed for this history.' };
      return reply({ error: errors[data.errorCode] || 'Unable to load sales reporting. Please try again.' }, 503);
    }
    // Explicit allowlist: never relay raw records or unexpected backend fields.
    const metrics = {}, quality = {};
    for (const key of ['paidCents', 'paidOrders', 'unpaidCents', 'unpaidOrders', 'uniqueCustomers', 'averageOrderCents', 'averageCustomerCents', 'identifiedPaidOrders', 'repeatCustomers', 'returningCustomers']) {
      const value = data.metrics?.[key];
      if (value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid report');
      metrics[key] = value;
    }
    for (const key of ['invalidDate', 'invalidAmount', 'duplicates', 'missingIdentity', 'missingReference', 'excludedStatus']) {
      if (!Number.isSafeInteger(data.quality?.[key]) || data.quality[key] < 0) throw new Error('Invalid report');
      quality[key] = data.quality[key];
    }
    if (!Array.isArray(data.months) || data.months.length > 2400 || !Number.isFinite(Date.parse(data.refreshedAt))) throw new Error('Invalid report');
    const months = data.months.map(row => {
      if (!/^\d{4}-\d{2}$/.test(row.month)) throw new Error('Invalid report');
      const result = { month: row.month };
      for (const key of ['paidCents', 'paidOrders', 'unpaidCents', 'unpaidOrders']) {
        if (!Number.isSafeInteger(row[key]) || row[key] < 0) throw new Error('Invalid report');
        result[key] = row[key];
      }
      return result;
    });
    return reply({ from, to, metrics, quality, months, refreshedAt: new Date(data.refreshedAt).toISOString(), source: 'test-orders' });
  } catch { return reply({ error: 'Unable to load sales reporting. Please try again.' }, 503); }
}
