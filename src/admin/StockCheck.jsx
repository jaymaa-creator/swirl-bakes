import { useState } from 'react';
import StockPage from '../components/StockPage.jsx';
import { comingSaturday } from './stockDates.js';
export default function StockCheck({environment}) {
  const [batch,setBatch] = useState(comingSaturday), [attempt,setAttempt] = useState(0);
  return <section className="mt-8" aria-label="Stock check">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-3xl">Stock check</h2><p className="mt-2 text-sm text-inkMuted">{environment === 'test' ? 'Test ingredients' : 'Live ingredients'} · Your have/buy choices are saved on this device.</p></div>
      <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold" onClick={()=>setAttempt(n=>n+1)}>Refresh ingredients</button>
    </div>
    <label className="mt-4 block text-sm font-semibold">Bake date<input className="ml-3 rounded-lg border border-line bg-white p-2" type="date" value={batch} onChange={e=>setBatch(e.target.value)} /></label>
    {batch ? <StockPage key={batch+attempt} adminMode isTestSite={environment === 'test'} batchKey={batch} onRetry={()=>setAttempt(n=>n+1)} /> : <p className="mt-4">Choose a Saturday bake date.</p>}
  </section>;
}
