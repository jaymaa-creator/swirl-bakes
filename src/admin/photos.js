const HOST = 'test-swirl-girl.jaemcd95.workers.dev';
function photoEnvironment(url, env) {
  if (url.hostname === HOST && env.ISOLATED_TEST_BACKEND === true) return 'test';
  if (url.hostname === 'swirlgirl.sg' && !env.ISOLATED_TEST_BACKEND) return 'production';
  return null;
}
const LIMIT = 2 * 1024 * 1024;
const ID = /^[a-z0-9][a-z0-9_-]{0,99}$/i;
const KEY = /^products\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}\/[a-f0-9]{64}\.webp$/;
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });

export async function readLimited(request, limit) {
  if (Number(request.headers.get('Content-Length')) > limit) throw new Error('File is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty request.');
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) { await reader.cancel(); throw new Error('File is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

// Validate container boundaries and the encoded frame, not the supplied MIME alone.
export function validWebp(bytes) {
  if (bytes.length < 30 || bytes.length > LIMIT) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = at => String.fromCharCode(...bytes.slice(at, at + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP' || view.getUint32(4, true) + 8 !== bytes.length) return false;
  let frame = false; let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = tag(offset); const size = view.getUint32(offset + 4, true); const at = offset + 8;
    if (at + size > bytes.length || ['ANIM', 'ANMF'].includes(kind)) return false;
    if (kind === 'VP8X') {
      if (size !== 10 || bytes[at] & 2) return false;
      const w = 1 + bytes[at + 4] + (bytes[at + 5] << 8) + (bytes[at + 6] << 16);
      const h = 1 + bytes[at + 7] + (bytes[at + 8] << 8) + (bytes[at + 9] << 16);
      if (w !== 1200 || h !== 900) return false;
    } else if (kind === 'VP8 ' || kind === 'VP8L') {
      if (frame) return false;
      let w; let h;
      if (kind === 'VP8 ') {
        if (size < 10 || bytes[at] & 1 || bytes[at + 3] !== 0x9d || bytes[at + 4] !== 1 || bytes[at + 5] !== 0x2a) return false;
        w = view.getUint16(at + 6, true) & 0x3fff; h = view.getUint16(at + 8, true) & 0x3fff;
      } else {
        if (size < 5 || bytes[at] !== 0x2f) return false;
        const bits = view.getUint32(at + 1, true);
        w = (bits & 0x3fff) + 1; h = ((bits >>> 14) & 0x3fff) + 1;
      }
      if (w !== 1200 || h !== 900) return false;
      frame = true;
    }
    offset = at + size + (size % 2);
  }
  return frame && offset === bytes.length;
}

export async function servePhoto(request, env) {
  const url = new URL(request.url); const key = url.pathname.slice('/api/media/'.length);
  if (!photoEnvironment(url, env) || !env.ADMIN_IMAGES || !KEY.test(key)) return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
  const object = await env.ADMIN_IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: {
    'Content-Type': 'image/webp', 'Content-Length': String(object.size),
    'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    'ETag': object.httpEtag,
  } });
}

export async function handlePhotos(request, env, loadMenu, email) {
  const url = new URL(request.url);
  const environment = photoEnvironment(url, env);
  if (!environment || !env.ADMIN_IMAGES) return reply({ error: 'Photo tools are not configured for this site.' }, 503);
  if (url.pathname === '/api/admin/menu') {
    if (request.method !== 'GET') return reply({ error: 'Method not allowed' }, 405);
    try { return reply(await loadMenu()); } catch { return reply({ error: 'Unable to load the current menu. Please refresh.' }, 503); }
  }
  const upload = url.pathname === '/api/admin/photos/upload';
  if (request.method !== (upload ? 'PUT' : 'POST')) return reply({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== url.origin) return reply({ error: 'Please use the admin page to update photos.' }, 403);
  try {
    if (upload) {
      const id = url.searchParams.get('productId');
      if (!ID.test(id || '')) return reply({ error: 'Invalid product.' }, 400);
      const menu = await loadMenu();
      if (!menu.products.some(p => p.id === id)) return reply({ error: 'Product is no longer in the menu.' }, 409);
      if (request.headers.get('Content-Type') !== 'image/webp') return reply({ error: 'Choose a converted WebP image.' }, 415);
      let bytes;
      try { bytes = await readLimited(request, LIMIT); } catch { return reply({ error: 'Image must be no larger than 2 MB.' }, 413); }
      if (!validWebp(bytes)) return reply({ error: 'Image must be a static 1200 × 900 WebP.' }, 400);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const hash = [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
      const key = `products/${id}/${hash}.webp`;
      await env.ADMIN_IMAGES.put(key, bytes, { httpMetadata: { contentType: 'image/webp' }, customMetadata: { productId: id, uploadedBy: email } });
      return reply({ imageUrl: `${url.origin}/api/media/${key}` });
    }
    let data;
    try { data = JSON.parse(new TextDecoder().decode(await readLimited(request, 4096))); } catch { return reply({ error: 'Invalid photo update.' }, 400); }
    const { productId, imageUrl, previousImageUrl } = data || {};
    const prefix = `${url.origin}/api/media/`;
    if (!ID.test(productId || '') || typeof imageUrl !== 'string' || !imageUrl.startsWith(prefix) || !KEY.test(imageUrl.slice(prefix.length)) || !imageUrl.startsWith(`${prefix}products/${productId}/`) || typeof previousImageUrl !== 'string' || previousImageUrl.length > 2048) return reply({ error: 'Invalid photo update.' }, 400);
    if (!await env.ADMIN_IMAGES.head(imageUrl.slice(prefix.length))) return reply({ error: 'Please upload the photo again.' }, 409);
    const response = await fetch(env.ORDER_SHEET_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adminProductPhoto', secret: env.ORDER_WEBHOOK_SECRET, environment, productId, imageUrl, previousImageUrl }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    if (result.errorCode === 'PHOTO_CONFLICT') return reply({ error: 'This product photo changed. Refresh the menu before trying again.' }, 409);
    if (!response.ok || result.ok !== true) return reply({ error: result.saved ? 'Photo saved, but menu publication failed. Retry publishing this photo.' : 'Unable to confirm the update. Retry this photo; repeated updates are safe.' }, 503);
    return reply({ ok: true, imageUrl });
  } catch { return reply({ error: 'Unable to confirm the update. Retry this photo; repeated updates are safe.' }, 503); }
}
