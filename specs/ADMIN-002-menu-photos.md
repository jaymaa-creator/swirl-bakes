# ADMIN-002: Test menu and product photos

## Goal / scope
Give the two existing Google admins a usable first tool: the current test menu
and a product-photo picker, 4:3 preview, WebP conversion and explicit publication.
This extends ADMIN-001's initially blank dashboard. No price, availability,
order, expense, loyalty or production changes are included.

## Design
Read the same published menu and use the same product merge rules as the
storefront (including sold-out items). JPEG/PNG/WebP inputs up to 15 MB become
1200x900 WebP in the browser, user-positioned 4:3 crop with 1–3× zoom, drag and accessible position sliders.
A separate confirmation preview appears before upload. Native WebP encoding is
preferred; a bundled, on-device WebAssembly encoder in a background Web Worker
handles browsers that return PNG, null or throw. The 2 MB limit still applies.
Reject unsupported formats, failed encoding, and source dimensions over 25 MP.
The authenticated Worker validates origin, bounded body, WebP container and
1200x900 dimensions. Content-addressed files live in a separate test R2 bucket;
public reads expose only those image paths, never bucket listings.

Google Sheets remains authoritative. An authenticated Apps Script command checks
the product and prior image under a lock, writes only image_url, flushes, then
explicitly publishes snapshots. A repeat of the same update is safe; a stale
update conflicts. Failed publication is reported separately from a saved Sheet
cell. The admin confirms the image in a fresh menu read before reporting it live.
No original uploads are kept. Unused converted uploads may remain in the test
bucket for manual cleanup; retain previous images for rollback. No D1 is needed.

## Acceptance / checks
- Only approved signed identities can upload/publish; same-origin writes only.
- Current menu, price, availability, remaining stock and images match storefront.
- Preview/cancel, converting/uploading/publishing/error/retry states are clear.
- Reject oversized, malformed, animated and wrong-dimension WebP uploads.
- Unknown products and stale updates cannot write; retries do not create orders.
- Test-only host, bucket, Sheet and snapshot prefix; production has no binding.
- Focused Worker and Apps Script tests, full suite, lint and build.
- Test deployment and public smoke; actual Google-session upload check when available.

## Rollback / dependencies
R2 already enabled; dedicated swirl-girl-admin-test bucket. Updated isolated
Apps Script web-app version is required, not just source push. Roll back the
Worker and restore a prior Sheet image_url then republish to undo an image.
Keep stored prior images. Production release is a separate task.

R2 API reference: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/

## Approved production alignment — 2026-10-28

The user approved aligning storefront, Google-login admin and photo tools with
production. This supersedes the original test-only rollout restriction for these
features. Sales reporting remains enabled only in test. Both sites share the
same storefront/admin code, while preserving separate menu/order Sheets, KV,
Access audiences and R2 buckets. Production uses swirlgirl.sg and
swirl-girl-admin-production. Each photo command validates its environment,
script identity and exact image origin; cross-environment updates fail closed.
Production UI says Live workspace and Publish photo to live menu. No existing
menu, stock, order or photo values are copied from test during deployment.
