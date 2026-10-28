export function encodeWithWorker(pixels) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./webp.worker.js', import.meta.url), { type: 'module' });
    const finish = (error, buffer) => {
      clearTimeout(timer);
      worker.terminate();
      if (error) reject(new Error(error));
      else resolve(new Blob([buffer], { type: 'image/webp' }));
    };
    const timer = setTimeout(() => finish('Photo conversion took too long. Please try again.'), 60000);
    worker.onmessage = ({ data }) => {
      if (data?.buffer instanceof ArrayBuffer && data.buffer.byteLength) finish(null, data.buffer);
      else finish('Unable to convert this photo. Please try again.');
    };
    worker.onerror = event => { event.preventDefault(); finish('Photo converter could not load. Check your connection and try again.'); };
    worker.onmessageerror = () => finish('Unable to read the converted photo. Please try again.');
    try { worker.postMessage(pixels, [pixels.data.buffer]); }
    catch { finish('Unable to prepare this photo. Please try again.'); }
  });
}

// Safari can return PNG even when WebP was requested. Never relabel those bytes.
export async function encodeCanvasWebp(canvas, fallback = encodeWithWorker) {
  let blob;
  try { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85)); }
  catch { /* A supported image may still need the bundled converter. */ }
  if (!blob || blob.type !== 'image/webp') {
    blob = await fallback(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height));
  }
  if (!blob || blob.type !== 'image/webp') throw new Error('Unable to convert this photo. Please try again.');
  if (blob.size > 2 * 1024 * 1024) throw new Error('The converted photo is too large. Choose a simpler or smaller photo.');
  return blob;
}
