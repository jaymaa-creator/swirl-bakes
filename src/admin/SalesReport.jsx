import { useEffect, useState } from 'react';
const money = cents => cents == null ? '—' : `S$${new Intl.NumberFormat('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)}`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const warnings = { invalidDate: 'Rows excluded because their order date is missing or invalid (across all history)', invalidAmount: 'Rows excluded because their amount is invalid', duplicates: 'Duplicate order rows excluded', missingIdentity: 'Paid orders without a usable customer identity (included in sales, excluded from customer metrics)', missingReference: 'Orders without a reference; duplicates cannot be checked', excludedStatus: 'Cancelled or refunded orders excluded' };
export default function SalesReport({ environment = 'test' }) {
  const isProduction = environment === 'production';
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [query, setQuery] = useState({ from: '', to: '', version: 0 });
  const [report, setReport] = useState(null); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/reports?${new URLSearchParams({ from: query.from, to: query.to })}`, { signal: controller.signal, cache: 'no-store', redirect: 'error' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load reports.'); return data; })
      .then(data => { setReport(data); setLoading(false); })
      .catch(error => { if (error.name !== 'AbortError') { setError(error.message || 'Unable to load reports. Try signing in again.'); setLoading(false); } });
    return () => controller.abort();
  }, [query]);
  function apply(start, end) {
    setLoading(true); setReport(null); setError(''); setFrom(start); setTo(end);
    setQuery(current => ({ from: start, to: end, version: current.version + 1 }));
  }
  const m = report?.metrics;
  return <section className="mt-8" aria-labelledby="sales-title">
    <p className="text-sm font-semibold text-brandBrown">{isProduction ? 'Live workspace' : 'Test workspace'} · Existing orders</p>
    <h2 id="sales-title" className="font-display text-3xl">Sales & customers</h2>
    <p className="mt-3 text-inkMuted">A clearer view of recorded orders. Google Sheets remains the master; this dashboard does not change any sales records.</p>
    <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); apply(from, to); }}>
      <label className="text-sm">Order date from<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-line bg-white p-2" /></label>
      <label className="text-sm">Through<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-lg border border-line bg-white p-2" /></label>
      <button disabled={loading} className="rounded-full bg-brandBrown px-5 py-2 text-white disabled:opacity-50">Apply / refresh</button>
      <button type="button" disabled={loading} className="px-2 py-2 underline" onClick={() => apply('', '')}>All time</button>
      <button type="button" disabled={loading} className="px-2 py-2 underline" onClick={() => { const end = today(); apply(end.slice(0, 7) + '-01', end); }}>This month</button>
    </form>
    {loading && <p className="mt-6" role="status">Reading your order history…</p>}
    {error && <p className="mt-6 rounded-xl border border-red-300 bg-white p-4" role="alert">{error}</p>}
    {report && <>
      <p className="mt-4 text-sm text-inkMuted">Showing {report.from || 'earliest record'} to {report.to || 'latest record'} · Singapore order dates<br />Source: {isProduction ? 'live' : 'test'} Orders sheet · Refreshed {new Date(report.refreshedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Paid order value', money(m.paidCents), `${m.paidOrders} orders marked paid`],
          ['Unique paying customers', m.uniqueCustomers, 'Distinct identities on paid orders in this period'],
          ['Average paid order', money(m.averageOrderCents), 'Paid order value ÷ paid orders'],
          ['Spend per customer', money(m.averageCustomerCents), `Value of ${m.identifiedPaidOrders} identified paid orders ÷ ${m.uniqueCustomers} customers`],
          ['Repeat customers', m.repeatCustomers, 'Customers with 2+ paid orders within this period'],
          ['Returning customers', m.returningCustomers ?? '—', report.from ? 'Had a paid order before this period' : 'Choose a start date to measure returning customers'],
        ].map(([label, value, detail]) => <article key={label} className="rounded-card border border-line bg-white p-5"><h3 className="text-sm text-inkMuted">{label}</h3><p className="mt-2 font-display text-3xl">{value}</p><p className="mt-2 text-xs text-inkMuted">{detail}</p></article>)}
      </div>
      <div className="mt-5 rounded-card border border-line bg-surface p-5"><h3 className="font-display text-xl">Unpaid reservations</h3><p className="mt-2">{m.unpaidOrders} orders · {money(m.unpaidCents)}</p><p className="mt-1 text-sm text-inkMuted">Kept separate from paid sales. Marking an order paid still happens in the Sheet.</p></div>
      <h3 className="mt-8 font-display text-2xl">Monthly trend</h3>
      {!report.months.length ? <p className="mt-3">No valid orders in this date range.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line"><th className="py-3 pr-3">Order month</th><th className="p-3">Paid value</th><th className="p-3">Paid orders</th><th className="p-3">Unpaid value</th></tr></thead><tbody>{report.months.map(row => <tr key={row.month} className="border-b border-line"><th className="py-3 pr-3 font-normal">{row.month}</th><td className="p-3"><span>{money(row.paidCents)}</span><div aria-hidden="true" className="mt-1 h-1 rounded bg-brandCinnamon" style={{ width: `${Math.max(0, row.paidCents / Math.max(1, ...report.months.map(x => x.paidCents)) * 100)}%` }} /></td><td className="p-3">{row.paidOrders}</td><td className="p-3">{money(row.unpaidCents)}</td></tr>)}</tbody></table></div>}
      {Object.values(report.quality).some(n => n > 0) && <aside className="mt-6 rounded-card border border-line bg-white p-5"><h3 className="font-display text-xl">Data to be aware of</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{Object.entries(report.quality).filter(([, count]) => count > 0).map(([key, count]) => <li key={key}>{warnings[key]}: {count}</li>)}</ul></aside>}
      <details className="mt-6 text-sm text-inkMuted"><summary className="cursor-pointer font-semibold">How these figures are calculated</summary><p className="mt-3">Paid means the Sheet is marked Paid or its status is Paid. Figures use the order date, not the date money arrived. Recorded discounts are already deducted; delivery is included. Cancelled and refunded orders are excluded. These are operational figures, not profit or a bank reconciliation.</p><p className="mt-3">Customer matching uses customer keys and normalised phone numbers, never names. Shared numbers count as one customer. Orders without an identity remain in order totals but are excluded from customer averages. Blank averages mean there are no qualifying records. {!isProduction && 'Test history may contain copied and rehearsal orders; these are not live business results.'}</p></details>
    </>}
  </section>;
}
