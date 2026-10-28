import { useEffect, useRef, useState } from 'react';
import { MENU } from '../config/products.js';
import { mergeMenuSettings } from '../lib/menuSettings.js';
import { openPhoto, convertBitmap } from './convertPhoto.js';
import PhotoCropper from './PhotoCropper.jsx';

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', redirect: 'error', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to complete this request. Try signing in again.');
  return result;
}
const button = 'rounded-full bg-brandBrown px-5 py-2 text-white disabled:opacity-50';

export default function MenuPhotos({ environment = 'test' }) {
  const menuLabel = environment === 'production' ? 'live menu' : 'test menu';
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  async function refresh() {
    setError(''); setBusy('Refreshing menu…');
    try { setMenu(await api('/api/admin/menu')); }
    catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  useEffect(() => {
    let active = true;
    const counter = generation;
    api('/api/admin/menu').then(data => { if (active) setMenu(data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; counter.current++; };
  }, []);
  useEffect(() => () => { if (draft?.preview) URL.revokeObjectURL(draft.preview); }, [draft?.preview]);
  useEffect(() => () => { editing?.bitmap.close(); }, [editing]);
  const products = menu ? mergeMenuSettings(MENU.filter(p => menu.products.some(raw => raw.id === p.id)), menu) : [];
  async function choose(product, file) {
    if (!file) return;
    const attempt = ++generation.current;
    setDraft(null); setError(''); setMessage(''); setBusy('Preparing your photo…');
    try {
      const bitmap = await openPhoto(file);
      if (attempt !== generation.current) { bitmap.close(); return; }
      setEditing({ product, bitmap });
    } catch (error) { if (attempt === generation.current) setError(error.message); }
    finally { if (attempt === generation.current) setBusy(''); }
  }
  async function applyCrop(zoom, horizontal, vertical) {
    setBusy('Preparing cropped photo…'); setError('');
    try {
      const blob = await convertBitmap(editing.bitmap, zoom, horizontal, vertical);
      setDraft({ product: editing.product, blob, preview: URL.createObjectURL(blob), previousImageUrl: menu.products.find(p => p.id === editing.product.id)?.imageUrl || '' });
      setEditing(null);
    } catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  async function publish() {
    setError(''); setMessage('');
    let imageUrl = draft.imageUrl;
    try {
      if (!imageUrl) {
        setBusy('Uploading photo…');
        const uploaded = await api(`/api/admin/photos/upload?productId=${encodeURIComponent(draft.product.id)}`, { method: 'PUT', headers: { 'Content-Type': 'image/webp' }, body: draft.blob });
        imageUrl = uploaded.imageUrl;
        setDraft(current => ({ ...current, imageUrl }));
      }
      setBusy(draft.published ? 'Checking the menu…' : `Publishing to the ${menuLabel}…`);
      if (!draft.published) await api('/api/admin/photos/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: draft.product.id, imageUrl, previousImageUrl: draft.previousImageUrl }) });
      setDraft(current => ({ ...current, published: true }));
      const updated = await api('/api/admin/menu');
      setMenu(updated);
      if (updated.products.find(p => p.id === draft.product.id)?.imageUrl === imageUrl) {
        setMessage(`${draft.product.name} photo is live on the ${menuLabel}.`); setDraft(null);
      } else {
        setMessage('Photo saved and published. The menu is still updating; wait a minute, then choose Check update.');
      }
    } catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  return <section className="mt-8" aria-labelledby="menu-heading">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm font-semibold text-brandBrown">{environment === 'production' ? 'Live workspace' : 'Test workspace'}</p><h2 id="menu-heading" className="font-display text-3xl">Active menu</h2></div>
      <button className="underline disabled:opacity-50" onClick={refresh} disabled={!!busy || !!draft || !!editing}>Refresh menu</button>
    </div>
    <p className="mt-3 text-inkMuted">Update photos here. Prices, stock and availability are still managed in Google Sheets.</p>
    {menu && <p className="mt-2 text-sm text-inkMuted">Bake: {menu.batchKey || menu.defaultBatch || 'No scheduled bake'} · {products.length} products · Photos apply to every bake date.</p>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-300 bg-white p-4">{error}</p>}
    <div role="status" aria-live="polite" className="mt-4">{busy || message || (!menu && !error ? 'Loading current menu…' : '')}</div>
    {editing && <PhotoCropper bitmap={editing.bitmap} name={editing.product.name} busy={!!busy} onApply={applyCrop} onCancel={() => { setEditing(null); setError(''); }} />}
    {draft && <div className="my-6 rounded-card border border-line bg-white p-5">
      <h3 className="font-display text-2xl">Preview: {draft.product.name}</h3>
      <img src={draft.preview} alt={`New photo for ${draft.product.name}`} className="mt-4 aspect-[4/3] w-full max-w-lg rounded-xl object-cover" />
      <p className="mt-3 text-sm text-inkMuted">Your 4:3 crop · WebP · {Math.round(draft.blob.size / 1024)} KB. Check that your product fits before publishing.</p>
      <div className="mt-4 flex flex-wrap gap-4"><button className={button} onClick={publish} disabled={!!busy}>{draft.published ? 'Check update' : `Publish photo to ${menuLabel}`}</button><button className="underline" disabled={!!busy} onClick={() => { setDraft(null); setError(''); setMessage(''); }}>Cancel</button></div>
    </div>}
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map(product => <article key={product.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
        {product.image ? <img src={product.image} alt={product.name} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-white text-inkMuted">No photo yet</div>}
        <div className="p-5"><h3 className="font-display text-xl">{product.name}</h3>
          <p className="mt-1">{product.priceSgd == null ? 'Price not set' : `S$${product.priceSgd.toFixed(2)}`} <span className="text-sm text-inkMuted">{product.unitLabel}</span></p>
          <p className="mt-2 text-sm">{product.available ? 'Available' : 'Sold out'}{product.remainingQuantity != null ? ` · ${product.remainingQuantity} remaining` : ''}</p>
          <label className="mt-4 block text-sm font-semibold">Replace photo
            <input aria-label={`Replace photo for ${product.name}`} className="mt-2 block w-full text-sm file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-2 disabled:opacity-50" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy || !!draft || !!editing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; choose(product, file); }} />
          </label>
        </div>
      </article>)}
    </div>
    {menu && !products.length && <p className="mt-6">No active products are published for this bake.</p>}
    <p className="mt-5 text-sm text-inkMuted">JPG, PNG or WebP, up to 15 MB and 25 megapixels. HEIC: export as JPG first. Choosing a photo creates a preview; only Publish changes the {menuLabel}.</p>
  </section>;
}
