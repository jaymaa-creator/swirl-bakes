import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import encode, { init } from '@jsquash/webp/encode.js';
import { simd } from 'wasm-feature-detect';
import { encodeCanvasWebp } from '../src/admin/encodeWebp.js';
import { validWebp } from '../src/admin/photos.js';

const pixels = { width: 1200, height: 900, data: new Uint8ClampedArray(1200 * 900 * 4).fill(255) };
const canvas = (blob, throws = false) => ({ width: 1200, height: 900, toBlob(callback) { if (throws) throw new Error('unsupported'); callback(blob); }, getContext: () => ({ getImageData: () => pixels }) });

test('native WebP avoids loading the fallback', async () => {
  const native = new Blob(['webp'], { type: 'image/webp' });
  assert.equal(await encodeCanvasWebp(canvas(native), () => { throw new Error('Should not run'); }), native);
});

test('PNG, null and throwing native encoders use cropped pixels and real WASM WebP output', async () => {
  const filename = await simd() ? 'webp_enc_simd.wasm' : 'webp_enc.wasm';
  const module = await WebAssembly.compile(await readFile(new URL(`../node_modules/@jsquash/webp/codec/enc/${filename}`, import.meta.url)));
  await init(module);
  let calls = 0;
  const fallback = async input => { calls++; assert.equal(input, pixels); return new Blob([await encode(input, { quality: 85 })], { type: 'image/webp' }); };
  for (const source of [canvas(new Blob(['png'], { type: 'image/png' })), canvas(null), canvas(null, true)]) {
    const result = await encodeCanvasWebp(source, fallback);
    assert.equal(result.type, 'image/webp');
    assert.equal(validWebp(new Uint8Array(await result.arrayBuffer())), true);
  }
  assert.equal(calls, 3);
});

test('fallback failure, wrong MIME and oversize output cannot become uploadable photos', async () => {
  await assert.rejects(encodeCanvasWebp(canvas(null), async () => { throw new Error('offline'); }), /offline/);
  await assert.rejects(encodeCanvasWebp(canvas(null), async () => new Blob(['png'], { type: 'image/png' })), /Unable to convert/);
  await assert.rejects(encodeCanvasWebp(canvas(new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: 'image/webp' }))), /too large/);
});
