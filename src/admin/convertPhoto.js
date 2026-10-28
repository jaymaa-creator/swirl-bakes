import { encodeCanvasWebp } from './encodeWebp.js';

export function cropRectangle(width, height, zoom = 1, horizontal = 0.5, vertical = 0.5) {
  const cropWidth = Math.min(width, height * 4 / 3) / Math.max(1, Math.min(3, zoom));
  const cropHeight = cropWidth * 3 / 4;
  return { x: (width - cropWidth) * Math.max(0, Math.min(1, horizontal)), y: (height - cropHeight) * Math.max(0, Math.min(1, vertical)), width: cropWidth, height: cropHeight };
}

export async function openPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo. Export HEIC photos as JPG first.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This photo could not be opened. Try exporting it as JPG.'); }
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 25000000) {
    bitmap.close();
    throw new Error('Choose a photo up to 25 megapixels.');
  }
  return bitmap;
}

export async function convertBitmap(bitmap, zoom = 1, horizontal = 0.5, vertical = 0.5) {
    const crop = cropRectangle(bitmap.width, bitmap.height, zoom, horizontal, vertical);
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 900;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, 1200, 900);
    return encodeCanvasWebp(canvas);
}

export async function convertPhoto(file) {
  const bitmap = await openPhoto(file);
  try { return await convertBitmap(bitmap); }
  finally { bitmap.close(); }
}
