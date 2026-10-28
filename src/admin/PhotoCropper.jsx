import { useEffect, useRef, useState } from 'react';
import { cropRectangle } from './convertPhoto.js';

const clamp = value => Math.max(0, Math.min(1, value));
export default function PhotoCropper({ bitmap, name, busy, onApply, onCancel }) {
  const canvas = useRef(null);
  const drag = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0.5);
  const [vertical, setVertical] = useState(0.5);
  useEffect(() => {
    const crop = cropRectangle(bitmap.width, bitmap.height, zoom, horizontal, vertical);
    const context = canvas.current.getContext('2d');
    context.clearRect(0, 0, 1200, 900);
    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, 1200, 900);
  }, [bitmap, zoom, horizontal, vertical]);
  function move(event) {
    const start = drag.current;
    if (!start || busy || start.id !== event.pointerId) return;
    const crop = cropRectangle(bitmap.width, bitmap.height, zoom);
    const scale = crop.width / event.currentTarget.getBoundingClientRect().width;
    if (bitmap.width > crop.width) setHorizontal(clamp(start.x - (event.clientX - start.clientX) * scale / (bitmap.width - crop.width)));
    if (bitmap.height > crop.height) setVertical(clamp(start.y - (event.clientY - start.clientY) * scale / (bitmap.height - crop.height)));
  }
  return <div className="my-6 rounded-card border border-line bg-white p-5">
    <h3 className="font-display text-2xl">Crop: {name}</h3>
    <p className="mt-2 text-sm text-inkMuted">Drag the photo to position it. Zoom in for a closer crop, or use the position sliders.</p>
    <canvas ref={canvas} width="1200" height="900" aria-label={`Crop preview for ${name}`} className="mt-4 aspect-[4/3] w-full max-w-lg touch-none rounded-xl border border-line bg-cream" style={{ cursor: busy ? 'wait' : 'grab' }}
      onPointerDown={event => { if (busy || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: horizontal, y: vertical }; }}
      onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} />
    <fieldset disabled={busy} className="mt-4 grid max-w-lg gap-3">
      <legend className="sr-only">Adjust photo crop</legend>
      <label className="text-sm">Zoom · {zoom.toFixed(1)}×<input className="mt-1 block w-full" type="range" min="1" max="3" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <label className="text-sm">Horizontal position<input className="mt-1 block w-full" type="range" min="0" max="1" step="0.01" value={horizontal} onChange={event => setHorizontal(Number(event.target.value))} /></label>
      <label className="text-sm">Vertical position<input className="mt-1 block w-full" type="range" min="0" max="1" step="0.01" value={vertical} onChange={event => setVertical(Number(event.target.value))} /></label>
      <button type="button" className="justify-self-start underline" onClick={() => { setZoom(1); setHorizontal(0.5); setVertical(0.5); }}>Reset crop</button>
    </fieldset>
    <div className="mt-5 flex flex-wrap gap-4">
      <button className="rounded-full bg-brandBrown px-5 py-2 text-white disabled:opacity-50" disabled={busy} onClick={() => onApply(zoom, horizontal, vertical)}>Use this crop</button>
      <button className="underline" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
    <p className="mt-3 text-sm text-inkMuted">Nothing is uploaded until you confirm the preview and publish.</p>
  </div>;
}
