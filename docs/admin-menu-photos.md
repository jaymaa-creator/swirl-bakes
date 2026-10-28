# Test admin: menu and photos

Open https://test-swirl-girl.jaemcd95.workers.dev/admin and sign in with either
approved Google account. The list follows the current test storefront menu,
including sold-out products. It does not list hidden/unconfigured products.

1. Choose **Replace photo** on a product.
2. Choose JPG, PNG or WebP (15 MB maximum, up to 25 megapixels).
3. Drag to position the photo and adjust Zoom (1–3×). Position sliders also
   support keyboard adjustment. Choose **Use this crop**, then check the preview.
4. Select **Publish photo to test menu**. The browser creates a 1200x900 WebP;
   only that converted image is uploaded (2 MB maximum).
5. If the menu is still updating, wait a minute and select **Check update**.
   Confirmation means the new URL was read back from the published menu.

Photos apply across bake dates. HEIC is not supported in this first version;
export it as JPG first. Use **Reset crop** to return to the centred starting view. Prices,
availability and stock remain managed in the existing Sheet.

## Storage and write path

Dedicated private bucket: `swirl-girl-admin-test`, binding `ADMIN_IMAGES` in
`wrangler.test.jsonc` only. Worker exposes individual WebP objects under
`/api/media/products/<id>/<sha256>.webp`; it never lists the bucket publicly.
Content-hashed keys make repeated uploads of identical bytes reuse the same
object. There are no new database tables. Reference:
[Cloudflare R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

Existing Google Access JWT checks protect the admin page and all upload/publish
commands. Mutations additionally require same-origin requests. The Worker checks
size, WebP structure/dimensions and a known product before storing bytes.
The Apps Script `adminProductPhoto` command is secret-authenticated and explicitly
restricted to the isolated test project/environment. It finds one Products/Merch
row, compares the prior image_url under the script lock, writes only image_url,
flushes, and publishes snapshots explicitly. A repeated identical request retries
publication; another admin's intervening change returns a conflict.

If publication fails after the Sheet write, the UI says so and permits a safe
retry. A saved photo is not labelled live until the snapshot read confirms it.
A browser refresh loses the local preview; choosing the same source again is safe.
Old images and unused converted uploads are retained for manual cleanup/rollback.
No originals are uploaded. Storage has no application spending cap; use existing
Cloudflare usage monitoring. This small pilot does not promise unlimited free use.

## Verification and rollback

2026-10-26: isolated Apps Script v13 activated; test Worker
`99b8837d-57da-43c0-9973-633db99e6e88`. Real owner Chrome session verified
menu load, existing tote WebP conversion/preview, upload, Sheet publication, and
public image HTTP 200 as image/webp (234,078 bytes). Tote stock stayed at nine.
The test Sheet now points to the uploaded version of the same tote artwork.
Full current-release suite: 146 passing tests. Lint: zero errors, existing
SwirlGame hook warning. Build and test smoke passed. Partner/mobile and HEIC
conversion were not live-tested (HEIC is deliberately rejected).

Restore the previous image_url in the copied Sheet and republish to undo a photo.
Worker rollback baseline before this feature: d3fe0529-cdf7-4a42-bd3b-63863a6b82c9;
Apps Script baseline: v12. Keep Access protection and stored images during rollback.
Production has not been changed.

## iPhone conversion fallback

Browsers without native canvas WebP encoding use a bundled on-device converter
(@jsquash/webp 1.5.0) in a background Web Worker. No third-party image upload
service is used. Only the final cropped 1200x900 WebP is uploaded after Publish.
A network connection is needed to load the converter the first time. Failures
keep the crop editor open so the same crop can be retried. A 60-second timeout
and the existing 2 MB output limit apply.

Reference: https://github.com/jamsinclair/jSquash

## Production alignment (prepared 2026-10-28)

Production support uses the same crop/conversion tools at `/admin`, with a
separate `swirl-girl-admin-production` bucket and production Apps Script.
The session identifies the environment; reports remain test-only. Deployment
requires a distinct production Access audience and the same two approved users.
Current release preparation and verification are in context/progress.md.
