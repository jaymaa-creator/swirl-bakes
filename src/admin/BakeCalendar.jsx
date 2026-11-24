import { useEffect, useState } from 'react';

const localDay = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'});
const dateKey = date => date.toISOString().slice(0,10);
const button = 'rounded-full border border-line px-4 py-2 disabled:opacity-50';
async function calendarRequest(options) {
  const response = await fetch('/api/admin/calendar',{cache:'no-store',...options});
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Unable to load calendar.');
  return data;
}
export default function BakeCalendar() {
  const today = localDay.format(new Date());
  const [month, setMonth] = useState(today.slice(0,7));
  const [data,setData] = useState(null);
  const [draft,setDraft] = useState(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  async function load() {
    try { setData(await calendarRequest()); }
    catch (error) { setMessage(error.message); }
  }
  useEffect(()=>{load();},[]);
  const first = new Date(month+'-01T12:00:00Z');
  function move(offset) {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth()+offset);
    setMonth(dateKey(next).slice(0,7)); setDraft(null);
  }
  const saturdays = [];
  for (let i=1+(6-first.getUTCDay());i<=31;i+=7) {
    const day = new Date(first); day.setUTCDate(i);
    if (day.getUTCMonth()===first.getUTCMonth()) saturdays.push(dateKey(day));
  }
  function edit(date) {
    const prior = data.dates.filter(day=>day.date < date && day.open).at(-1);
    const old = data.dates.find(day=>day.date===date);
    const defaults = data.products.filter(p=>p.available).map(p=>p.id);
    setDraft({date,open:old?.open ?? false,previous:JSON.stringify(old||null),
      productIds:old?.productIds ?? prior?.productIds ?? (prior || old ? defaults : []),reservations:data.count[date] || 0});
    setMessage('');
  }
  async function publish() {
    setBusy(true);
    try {
      await calendarRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      setDraft(null); setMessage('Published and saved to the Calendar sheet.'); await load();
    } catch(error) {setMessage(error.message); await load();}
    finally {setBusy(false);}
  }
  return <section aria-labelledby="calendar-title"><h2 id="calendar-title" className="font-display text-3xl">Bake calendar</h2>
    <p role="status" className="my-2">{message || (!data && 'Loading Saturdays…')}</p>
    {!data && <button className={button} onClick={load}>Refresh</button>}
    {data && <fieldset disabled={busy}><div className="flex items-center justify-between py-4">
      <button className={button} aria-label="Previous month" onClick={()=>move(-1)}>←</button>
      <strong>{first.toLocaleDateString('en-SG',{month:'long',year:'numeric',timeZone:'UTC'})}</strong>
      <button className={button} aria-label="Next month" onClick={()=>move(1)}>→</button></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{saturdays.map(date=><button key={date} onClick={()=>edit(date)}
        aria-pressed={draft?.date===date} className="rounded-xl border border-line p-3 text-left aria-pressed:border-brandBrown">
        Sat {Number(date.slice(-2))}<br/><strong>{data.dates.find(day=>day.date===date)?.open?'Yes':'No'}</strong></button>)}</div>
      {draft && <div className="my-5 rounded-xl border border-line bg-surface p-4"><h3 className="font-display text-2xl">{draft.date}</h3>
        <p className="mb-3">{draft.reservations} existing reservations</p>
        <label><input type="checkbox" checked={draft.open} onChange={e=>setDraft({...draft,open:e.target.checked})}/> Open for orders</label>
        <fieldset className="my-4"><legend className="font-semibold">Products for this Saturday</legend>
        {data.products.map((p,i)=>{const duplicate=data.products.filter(other=>other.id===p.id).length>1;
          return <label key={p.id+'-'+i} className="flex items-center gap-3 py-2">
          <input type="checkbox" checked={draft.productIds.includes(p.id)} disabled={duplicate || p.price<=0} onChange={e=>setDraft({...draft,productIds:e.target.checked?[...draft.productIds,p.id]:draft.productIds.filter(id=>id!==p.id)})}/>
          {p.image && <img src={p.image} alt="" className="h-10 w-12 rounded object-cover"/>}{p.name}{duplicate && ' (duplicate product ID)'}</label>;})}</fieldset>
        <p className="mb-3 text-sm"><strong>Menu preview</strong> · {draft.open ? data.products.filter(p=>draft.productIds.includes(p.id)).map(p=>p.name).join(', ') || 'Choose products' : 'Closed'}</p>
        <button className={button} disabled={draft.date<today || (draft.open && !draft.productIds.length)} onClick={publish}>{busy?'Publishing…':'Publish Saturday'}</button></div>}
    </fieldset>}</section>;
}
