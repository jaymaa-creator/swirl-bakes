# Architecture Baseline

## Current System

```text
Customer browser
  -> Cloudflare Worker and static Vite/React assets
  -> GET /api/menu
  -> MENU_SNAPSHOT KV (no extra edge cache for published inventory)

Google Sheets
  -> Google Apps Script
  -> POST /api/menu/sync on production and test Workers
  -> MENU_SNAPSHOT KV plus edge-cache invalidation

Customer order form
  -> Cloudflare Turnstile when configured
  -> POST /api/orders on swirlgirl.sg only
  -> Google Apps Script web app -> Orders sheet
  -> reference-bearing WhatsApp link opened by a separate customer click
```

## Runtime Responsibilities

### Frontend

The Vite/React application renders the public storefront and the `/stock` page.
It requests menu data from `/api/menu`, creates the order payload, and opens a
WhatsApp handoff. It must not contain service secrets.

### Cloudflare Worker

`src/worker.js` serves built assets and owns `/api/*`. It reads and publishes
menu snapshots, caches menu and stock responses, validates public order
requests, optionally verifies Turnstile, and relays order writes to Apps
Script. `/api/orders` accepts requests only on `swirlgirl.sg`; preview and test
hosts cannot create real orders. `/api/stock` is restricted to `test-*` hosts.

As approved on 2026-09-08, submission immediately opens a receipt and clears the
basket. A single order request runs in the background. The receipt incorporates
its reference when received, with a direct WhatsApp link. After eight seconds,
a delayed-reference state also allows WhatsApp without retrying the write.
The latest receipt survives reload in sessionStorage; pending receipts restored
after reload are shown as unverified/delayed, never implicitly resubmitted.

### Cloudflare KV And Cache

`MENU_SNAPSHOT` stores bundled menu snapshots. Published menu and stock reads
go directly to KV and return no-store responses. Cache API deletion only affects
the publishing location, so it cannot reliably invalidate stock worldwide.
Only the legacy unseeded-Sheets fallback uses a five-minute edge cache. KV is
eventually consistent, so its own propagation delay still applies. Each menu
request now uses a KV read rather than the former 15-minute edge cache.

### Google Sheets And Apps Script

The Apps Script project reads operational product/calendar data, writes order
rows, generates order numbers, and publishes menu snapshots. Script properties
hold endpoints and shared webhook secret configuration.

Orders flush their Sheet row and release the order lock before returning the
reference. Menu publication no longer runs inside that lock. The Worker starts
an authenticated refresh using waitUntil after a menuRefreshDeferred response;
an Apps Script time trigger provides a backup refresh after about 60 seconds.
The response flag avoids calling a new action on older web-app deployments.

## Architectural Invariants

1. Customer-facing menu reads must not query Google Sheets directly.
2. Google Sheets is the operator control surface; KV is the customer runtime
   read model.
3. Production and test snapshot publication must remain separate.
4. Only authenticated sync requests may write menu snapshots.
5. Browser code must never contain Worker, Apps Script, or payment secrets.
6. Existing WhatsApp ordering must remain available during a future payment
   feature unless a spec explicitly replaces it.
7. External writes must fail safely and return clear errors without exposing
   secret values.
8. Any future payment transaction identifier must be idempotent and must not
   confirm more than one order.

## Known Boundaries To Verify Before Payment Design

- Deployment metadata was checked on 2026-08-27: Cloudflare lists Worker
  version `0d95a27c-d121-4886-9e7d-56a8a31e22cd` (created 2026-08-24), and
  `clasp` lists an Apps Script `HEAD` deployment plus version 27. This confirms
  that deployments exist, not that a complete live menu/order flow succeeds.
- The precise production and test Worker bindings and custom-domain routes are
  deployment configuration, not committed in `wrangler.jsonc`.
- The current Google Sheet columns and Apps Script deployment settings must be
  reviewed against the live operator setup before a schema-changing spec.
- The repository has no established persistent payment-order state model.
