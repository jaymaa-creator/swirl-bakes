import { useEffect, useRef, useState } from 'react';
import CinnamonLoader from '../components/ui/CinnamonLoader';
import { summariseBakeOrders, parseDeliveryCost } from './bakeOrderSummary.js';
const money = cents => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(cents / 100);
const dateLabel = date => date ? new Intl.DateTimeFormat('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }).format(new Date(date + 'T00:00:00+08:00')) : 'No upcoming bake';
const button = 'rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50';

function DeliveryCostForm({ order, disabled, update }) {
  const [value, setValue] = useState(order.deliveryCostCents == null ? '' : (order.deliveryCostCents / 100).toFixed(2));
  const [error, setError] = useState('');
  return <form className="mt-4 rounded-xl bg-cream p-4" onSubmit={event => {
    event.preventDefault();
    if (disabled) return;
    const deliveryCostCents = parseDeliveryCost(value);
    if (deliveryCostCents === null) { setError('Enter an amount from S$0 to S$1,000, with up to two decimal places.'); return; }
    setError(''); update({ order, change: 'deliveryCost', deliveryCostCents });
  }}>
    <label className="block text-sm font-semibold">Our delivery cost (S$)
      <input className="mt-2 block w-full rounded-lg border border-line bg-white p-2" type="text" inputMode="decimal" maxLength={7} value={value} disabled={disabled} onChange={event => {setValue(event.target.value); setError('');}} placeholder="Not recorded" />
    </label>
    <p className="mt-2 text-xs text-inkMuted">What we paid the driver. This does not change the customer’s total.</p>
    {order.deliveryCostInvalid && <p className="mt-2 text-sm text-amber-900">The recorded cost needs checking in the Sheet.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-amber-900">{error}</p>}
    <button className={button + ' mt-3'} disabled={disabled || !value.trim() || (parseDeliveryCost(value) !== null && parseDeliveryCost(value) === order.deliveryCostCents)}>Save delivery cost</button>
  </form>;
}

export function BakeOrdersView({ data, loading, error, notice, filter, setFilter, setBatch, refresh, busy, confirmation, setConfirmation, update }) {
  const summary = data && summariseBakeOrders(data.orders);
  const disabled = loading || busy || Boolean(error);
  const orders = data?.orders.filter(o => !o.cancelled && (filter === 'all' || (filter === 'unpaid' && !o.paid) || (filter === 'pending' && !o.completed) || (filter === 'completed' && o.completed))) || [];
  const cancelled = data?.orders.filter(o => o.cancelled) || [];
  const quality = data && Object.values(data.quality).some(n => n > 0);
  const card = (order, index) => <article key={order.orderNumber + index} className="rounded-2xl border border-line bg-white p-5">
    <div className="flex flex-wrap justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-brandBrown">{order.orderNumber || 'Missing reference'}</p><h3 className="mt-1 text-xl font-semibold">{order.name || 'Name not recorded'}</h3></div>
      <div className="flex flex-wrap items-start gap-2 text-xs"><span className={`rounded-full px-3 py-1 ${order.paid ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-900'}`}>{order.paid ? 'Paid' : 'Unpaid'}</span><span className="rounded-full bg-cream px-3 py-1">{order.cancelled ? order.status : order.completed ? 'Completed' : order.status || 'To fulfil'}</span></div>
    </div>
    {order.phone && <a className="mt-2 inline-block text-sm underline" href={`https://wa.me/${order.phone}`} target="_blank" rel="noopener noreferrer">+{order.phone}</a>}
    <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{order.itemsText}</p>
    <p className="mt-3 font-semibold">{order.amountCents === null ? 'Amount needs checking' : money(order.amountCents)}</p>
    <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
      <div><dt className="text-inkMuted">Fulfilment</dt><dd>{order.fulfilment || 'Not recorded'}{order.collectionSlot && ` · ${order.collectionSlot}`}</dd></div>
      {order.address && <div><dt className="text-inkMuted">Delivery address</dt><dd className="whitespace-pre-wrap break-words">{order.address}</dd></div>}
      {order.notes && <div><dt className="text-inkMuted">Order notes</dt><dd className="whitespace-pre-wrap break-words">{order.notes}</dd></div>}
    </dl>
    {/^delivery(?:\s|$)/i.test(order.fulfilment) && (order.editable
      ? <DeliveryCostForm key={order.revision} order={order} disabled={disabled} update={update} />
      : <p className="mt-4 text-sm">Our delivery cost: {order.deliveryCostInvalid ? 'Needs checking' : order.deliveryCostCents == null ? 'Not recorded' : money(order.deliveryCostCents)}</p>)}
    {!order.editable && !order.cancelled && <p className="mt-4 text-sm text-amber-900">{order.duplicate ? 'Duplicate reference — check the Sheet before updating.' : 'Check this order in the Sheet before updating.'}</p>}
    {order.editable && <div className="mt-5 flex flex-wrap gap-2">
      {!order.paid && <button className={button} disabled={disabled} onClick={() => setConfirmation({ order, change: 'paid' })}>Mark paid</button>}
      {!order.completed && <button className={button} disabled={disabled} onClick={() => setConfirmation({ order, change: 'completed' })}>Mark completed</button>}
    </div>}
    {confirmation?.order.revision === order.revision && confirmation?.order.orderNumber === order.orderNumber && <div className="mt-4 rounded-xl bg-cream p-4" role="group" aria-label="Confirm order update">
      <p className="text-sm">{confirmation.change === 'paid' ? 'Have you checked that this payment arrived in the bank? This also processes any eligible referral credit.' : 'Has this order been collected or delivered? This marks it Closed in the Sheet and does not mark it paid.'}</p>
      <div className="mt-3 flex gap-2"><button className={button + ' bg-brandBrown text-white'} disabled={disabled} onClick={() => update(confirmation)}>{busy ? 'Saving…' : confirmation.change === 'paid' ? 'Confirm paid' : 'Confirm completed'}</button><button className={button} disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button></div>
    </div>}
  </article>;
  return <section className="mt-8" aria-label="This coming bake">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-brandBrown">{data?.source === 'test-orders' ? 'Test orders' : 'Bake preparation'}</p><h2 className="mt-2 font-display text-3xl">This coming bake</h2><p className="mt-2 text-inkMuted">Orders to prepare, payments to check and handovers to finish.</p></div><button className={button} disabled={loading || busy} onClick={refresh}>Refresh orders</button></div>
    {loading && <div className="mt-6 flex items-center gap-3" role="status"><CinnamonLoader size={40} /><span>Loading bake orders…</span></div>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-line bg-white p-4">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-white p-4">{notice}</p>}
    {data && <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <label className="text-sm font-semibold">Bake date<select className="ml-3 rounded-lg border border-line bg-white p-2" value={data.batch} disabled={loading || busy} onChange={e => setBatch(e.target.value)}>{!data.batch && <option value="">No upcoming bake</option>}{data.bakeDates.map(date => <option key={date} value={date}>{dateLabel(date)}</option>)}</select></label>
        <p className="text-xs text-inkMuted">{data.source === 'test-orders' ? 'Test Sheet' : 'Live Sheet'} · Updated {new Intl.DateTimeFormat('en-SG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Singapore' }).format(new Date(data.refreshedAt))} SGT</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Orders', summary.orders], ['To fulfil', summary.orders - summary.completed], ['Completed', summary.completed], ['Unpaid', `${summary.unpaid} · ${money(summary.unpaidCents)}`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-inkMuted">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>
      {quality && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" role="status"><p className="font-semibold">Some records need checking</p><p className="mt-1">{Object.entries(data.quality).filter(([, count]) => count).map(([key, count]) => `${count} ${{invalidDate:'unreadable bake dates in the Sheet',duplicates:'duplicate records',missingReference:'missing references',invalidAmount:'invalid amounts',invalidItems:'unreadable item lists'}[key]}`).join(' · ')}.</p><p className="mt-1">Duplicates and missing references are excluded from totals. Unreadable amounts or items are not estimated.</p></div>}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5"><h3 className="font-semibold">Quantities to prepare</h3><p className="mt-1 text-xs text-inkMuted">All active orders for this bake, including completed orders. Quantities use the units in each order; cancelled orders are excluded.</p>{summary.items.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{summary.items.map(item => <li className="flex justify-between gap-4 text-sm" key={item.name}><span>{item.name}</span><strong className="shrink-0">× {item.quantity}</strong></li>)}</ul> : <p className="mt-4 text-sm text-inkMuted">No quantities recorded for this bake.</p>}</div>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Filter bake orders">{[['all','All orders'],['pending','To fulfil'],['unpaid','Unpaid'],['completed','Completed']].map(([value,label]) => <button key={value} className={button + (filter === value ? ' bg-brandBrown text-white' : '')} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</nav>
      <p className="mt-3 text-xs text-inkMuted">Only mark paid after checking the bank. Completion and payment are separate.</p>
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2">{orders.map(card)}</div>
      {!orders.length && <p className="mt-6 rounded-2xl border border-line p-6 text-inkMuted">{!data.batch ? 'No upcoming bake is scheduled yet.' : 'No orders match this view.'}</p>}
      {cancelled.length > 0 && <details className="mt-6"><summary className="cursor-pointer text-sm font-semibold">Cancelled / excluded orders ({cancelled.length})</summary><div className="mt-4 grid gap-4 lg:grid-cols-2">{cancelled.map(card)}</div></details>}
    </>}
  </section>;
}

export default function BakeOrders() {
  const [batch, setBatch] = useState(''), [attempt, setAttempt] = useState(0), [data, setData] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all'), [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState(null);
  const writeController = useRef(null);
  useEffect(() => () => writeController.current?.abort(), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 35000);
    setLoading(true); setError(''); setConfirmation(null);
    fetch('/api/admin/bake-orders' + (batch ? `?batch=${encodeURIComponent(batch)}` : ''), { signal: controller.signal, cache: 'no-store', redirect: 'error' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); if (active) setData(result); })
      .catch(error => { if (active) setError(error.name === 'AbortError' ? 'Loading took too long. Refresh orders to try again.' : error.message || 'Unable to load orders. Please refresh.'); })
      .finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [batch, attempt]);
  const update = async ({ order, change, deliveryCostCents }) => {
    setBusy(true); setError(''); setNotice('');
    const controller = new AbortController(); writeController.current = controller;
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch('/api/admin/bake-orders', { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderNumber: order.orderNumber, batch: order.batch, revision: order.revision, change, ...(change === 'deliveryCost' ? { deliveryCostCents } : {}) }) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'The update could not be confirmed. Refresh before trying again.');
      setNotice(result.referralDeferred ? 'Paid status saved. Referral credit processing needs checking in the Sheet.' : change === 'deliveryCost' ? `${order.orderNumber} delivery cost saved to the Sheet.` : `${order.orderNumber} marked ${change}.`);
      setConfirmation(null); setAttempt(value => value + 1);
    } catch (error) { setError(error.name === 'AbortError' ? 'The update could not be confirmed. Refresh to check before trying again.' : error.message || 'The update could not be confirmed. Refresh before trying again.'); }
    finally { clearTimeout(timer); writeController.current = null; setBusy(false); }
  };
  return <BakeOrdersView {...{data,loading,error,notice,filter,setFilter,busy,confirmation,setConfirmation,update}} setBatch={value => {setNotice(''); setBatch(value);}} refresh={() => {setNotice(''); setAttempt(value => value + 1);}} />;
}
