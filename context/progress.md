# Progress

## Current Phase

Architecture baseline and payment discovery.

## Completed

- Order idempotency and authoritative validation deployed to production
  (2026-09-22). Browser submissions now carry structured line items and one
  UUID; Apps Script stores `Request ID` and `Request Fingerprint`, returns the
  original reference for an exact replay, and rejects changed-payload reuse.
  Worker and locked Apps Script checks cover body size/type, contact fields,
  batch, current stock, per-order limits, prices, add-ons, delivery threshold
  and fee, pickup/address rules, totals, and Turnstile retry identity. Display
  strings and browser totals are not trusted. 68 tests, lint, production build,
  and diff whitespace checks pass. Apps Script web app version 29 and Worker
  `1e3d8918-7628-4633-9aa5-c02880c559de` are live. Production serves the new
  asset, `/api/menu` returned the 2026-09-26 batch with eight products, and an
  empty order was rejected with HTTP 400 before any Sheet write. No real order
  was created; first successful order will add the two identity columns.

- Vite/React public storefront.
- Google Sheets product and calendar administration.
- Apps Script order recording and menu snapshot publication.
- Cloudflare KV menu snapshot read model and edge caching.
- Production/test menu snapshot publication paths.
- WhatsApp reservation handoff.
- Optional Turnstile validation for order recording.
- Test-only stock checklist route.
- Repository context baseline created on 2026-08-27.

## In Progress

- Guarded release automation (2026-09-23): local implementation now includes
  PR/main CI, exact-commit test and production workflows, immutable/checksummed
  build artifacts, GitHub environment approval gates, post-deploy smoke checks,
  deployment evidence, an exact-version rollback workflow, and a clean-tree
  local production guard. 78 tests, lint, production build, diff checks, YAML
  parsing, checksum-verified `actionlint`, and live non-writing smoke checks on
  both production and test pass. The local guard also refused missing
  confirmation and the current dirty tree as designed. Commit `4d7fb25` is on
  `main`; CI passed. GitHub `test` and `production` environments exist,
  production requires `jaymaa-creator` approval and only accepts `main`, and
  protected `main` requires a pull request plus the `verify` check. Cloudflare's
  legacy Git integration was disconnected after it auto-deployed commit
  `4f8c143` as Worker version `615d4acf-f572-400b-bf8f-d1e0d95e8d7a`;
  production remained
  healthy afterward (homepage 200, eight menu products, invalid order 400).
  A non-expiring account API token has Individual Workers Editor for
  `swirl-girl` and `test-swirl-girl`, plus account-wide legacy Workers Scripts
  Read because Wrangler queries the account Workers subdomain after upload;
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are stored in both GitHub
  environments. Test-only release run `35838781360` passed end to end for exact
  commit `4d7fb259017b229d6f318773f96f1fb0bba119ba`, producing test deployment
  `b36fe167-2407-4222-a6fb-1102d580a196`; the production job was skipped. Live
  follow-up smoke checks passed on test (homepage 200, eight menu products,
  invalid order 403) and production (homepage 200, eight menu products, invalid
  order 400). Controlled production rehearsal run `35840585138` deployed the
  same artifact as deployment `fc4b1209-bab4-4722-93ae-8943f5a098bf` / Worker
  version `7ee780d4-422c-48db-8015-ac4b3e0978ce`; its immediate GitHub-runner
  smoke check received one HTTP 403, although independent live checks passed.
  The smoke client now retries transient 403, 408, 425, 429, and 5xx responses;
  a corrected rehearsal remains pending.

- Production email monitoring for `jaemcd95@gmail.com`: implementation deployed
  as Apps Script version 30 and Worker
  `48251ceb-ba29-430b-85ac-589ea5cdef1b`. It includes 15-minute homepage and
  live-menu-versus-Sheet checks, oversell detection, durable Worker failure
  events, deduplicated alerts, and recovery notifications. 74 tests, lint,
  build, and diff checks pass; live menu is healthy and `/api/monitor` rejects
  unauthenticated access. Scheduling is pending one manual authorization run of
  `setupProductionMonitoring` in the Apps Script editor because the project has
  no API-executable deployment (`clasp run` returned `NOT_FOUND`). No test alert
  email has been confirmed yet.

- Coffee queue now uses dedicated side-profile phone users, all facing the
  shop, in one line. All 18 have phones; skin palette retained. Lint/build pass,
  live test DOM and screenshot verified; production serves same verified build.
  Test: 9f3eae4a-4922-42ca-b001-055457def819.
  Production: 0bccfe6d-2b09-468a-a154-f7ac3c41e440.

- User approved production rollout of collectible expansion. Coffee queue now
  18 people in one line, extending left ~3 house widths, drawn after facades
  so neighbouring buildings do not cover it. Album preview includes full queue.
  Test: 8619fe83-12e9-4f23-be3a-03a352296b5a.
  Production: feb3405e-afc0-40db-ae63-d942c6334b68.
  54 tests, lint/build pass. Live test queue geometry verified; production
  390/1440px restart/album/reduced-motion/layout checks pass. No order writes.

- Collection now unlocks when a full scene footprint is on screen (including
  the crash frame), not when it passes the bun. Updated copy; 54 tests and lint
  pass. Lounge tested with an isolated live-browser fixture ahead of bun.
  Crowd skin palette now light/golden/medium/deep, matching face/arms/legs;
  four distinct coffee-queue tones verified in live test DOM.
  Latest test-only deployment: d8e52b24-db54-4c7d-b394-cffa36edfb0b.
  Production unchanged.

- Bun Bounce collectible expansion deployed TEST ONLY (2026-09-15):
  3e29d102-6db3-48fe-b6e1-37bdb55df48b. 15 collectibles: four dog coats,
  KTV/Pub/Lounge with three crowd/neon options, Viral Coffee queue, contiguous
  Banh Mi/Pho/Saigon/Little Hanoi row, ornate heritage houses/photographers,
  double-width black Motorbike Bar/two cruisers, Swirl Girl HQ/logo character.
  Thresholds: dog/night 30, coffee 40, Vietnamese 50, heritage 60, bikes 80,
  HQ 100. Encounters every 10 points from 30; eligibility is not a guaranteed
  appearance. Collect by passing a scene; album saved browser-local under
  bun-bounce-collection-v1. Shared/global scoreboard is still not implemented.
  Score-banded Singlish messages and explicit Try again restart (including
  blocking Space on a focused retry button). Neon gently cycles and respects
  reduced motion. Memoized building artwork avoids rebuilding it each frame.
  53 tests, lint/build pass. Local simulated encounter verifies real collection
  flow; local and live-test browser checks at 390/1440px verify restart guard,
  pause, album reload, reduced motion and layout. Artwork screenshots inspected.
  Browser checks: /private/tmp/bun-expansion-check.mjs (ephemeral QA script).
  Production still serves assets/index-OHCrnw8o.js; no prod writes/deployment.

- Joo Chiat Road edition on both sites: updated intro/tagline and street sign;
  special shops at 30 points then every 10 (random type). All 45 tests,
  lint/build pass; live mobile heading, sign and start checked on both.
  Test: 3948c938-c880-4178-aaaa-9d7e461b1387.
  Production: 5ae05d34-9a41-4756-ba11-2c7e92445747.

- Bun Bounce approved for production and enabled on swirlgirl.sg/www.
  Production deployment: 2e7e082b-a148-4abe-ad9b-3dfb54471c76. Build/lint pass;
  live mobile homepage link opens /minigame in a new tab, start/restart work,
  opaque square and black outline verified. Includes score-based shops.
  Test retains the same game behavior. Global leaderboard remains unimplemented.

- Score-based shops supersede per-building randomness: first at 30 points,
  then random inclusive 13-40 point intervals; random KTV/dog grooming selection.
  Assigned to next off-screen house and pruned after passing. Thin black bun
  square outline included. 45 tests, lint/build pass. Test-only deployed:
  f5c0c819-43c1-4961-b2c8-2f565158911a. Milestones unit-tested; no live
  30-point playthrough performed. Global initials leaderboard still unimplemented.

- Game swirl square now opaque warm gold (#f4d59d), scoped to .flight-bun;
  shared loaders unchanged, no circular backing. Test deployed:
  a47ab68d-f9e2-4460-8263-f3fb5307edff. Build passed and live SVG opacity=1
  verified. Production unchanged.

- Removed the game bun's circular background, radius and shadow, retaining
  the shared SVG square/swirl unchanged. Test-only deployment:
  2cba105e-3061-4fe4-947b-7496ef2bb36d. Build passed; live computed styles
  verify transparent backing, no shadow, and retained square. Production unchanged.

- Special scenery frequency changed to every 30 buildings (KTV 30, grooming
  60, alternating). Focused tests and build pass. Test deployed:
  f90cea9f-35bd-454a-93b3-7036c2e65791. Includes red neon KTV, smoking figure,
  two-line Dog Grooming sign and redrawn paw; milestone artwork screenshots
  inspected from preceding test deployment. Production unchanged.

- Bun Bounce scenery milestones: scrolling row at 35 units/sec; every 100th
  building alternates KTV / dog grooming (100/200/300/400 tested). Six buildings
  rendered at a time, no accumulating scenery nodes. All 44 tests, lint/build
  pass. Test deployment: 579bb163-081a-4aca-a123-b9ba86bacb80. Live mobile
  scrolling verified; milestone cadence verified with unit tests, not a full
  100-building playthrough. Production unchanged.

- Bun Bounce refinements (2026-09-10): renamed UI, increased flap velocity
  from -300 to -360, and added pastel Peranakan shophouse SVG scenery behind
  obstacles. Test-only deployment: 1f9109ff-9f67-40f8-be25-8508b5fd9bf0.
  Lint/build pass; live mobile title, five houses and start verified. Existing
  best-score storage retained. Global leaderboard is proposed, not implemented.

- Weekly-special layout deployed to production (714402c1-b70d-478c-b3c6-77f30923d166)
  and test (262d4bd8-7d4a-4746-a42e-6f05bd2afd46). Live production first card
  verified as Milo special (2026-09-10).
- Swirl Flight mini-game added below Privacy, opens /minigame in a new tab.
  Lazy-loaded, test/local hostname gated; existing CinnamonLoader is the bird.
  Tap/click/Space/up controls, obstacles, scoring, local best, restart and
  visibility pause. Deployed TEST ONLY: 0bc5596c-0d0d-43f7-b1a5-ec72a3187ca5.
  All 43 tests, lint/build pass; live 390/1440px checks pass for new-tab launch,
  controls, collision and restart. Mobile screenshot inspected. Production
  has no game link. No order writes. Cache-refresh redesign remains pending.

- Weekly special presentation (2026-09-10): replaced the thumbnail banner and
  duplicate listing with one full product card first in the menu. Desktop uses
  a full-row image/details feature; mobile retains the full-width 4:3 image.
  Description, pricing, allergens and quantity controls retained. Local browser
  checks at 390/1440px confirm one listing and working basket selection;
  screenshots inspected. All 41 tests, lint and build pass. Not deployed.

- Cancellation audit (2026-09-10): added isolated Apps Script tests for exact
  multi-product quantity restoration, matching-bake isolation, repeated refresh,
  reinstatement, both availability environments, and Orders edit scheduling.
  All 41 tests and lint pass. No real orders changed and no deployment made
  for this audit; live cancellation-to-publication remains untested. Restoring
  the performance cache with reliable publication invalidation remains pending.

- Stock freshness fix (2026-09-10): production KV has 5 cinnamon-roll boxes
  sold but edge cache still served 6. Removing the extra 15-minute menu/stock
  cache for published snapshots completed. All 39 tests, lint, and build pass.
  Test deployed: 34005723-dd6a-4a63-80d0-81ec34f131aa.
  Production deployed: b5d1513c-7a12-407c-9f28-eb25a5167502.
  Live mobile browser checks on both hosts show 19 September, 5 boxes sold,
  1 remaining, and an enabled 1-box selector without a sold-out badge.
  Static assets unchanged; no order writes or Sheet changes. KV propagation
  remains eventually consistent; published reads no longer use the edge cache.

- Receipt waiting message now has a 96px swirl on each side with centred,
  wrapping text (2026-09-09). Deployed to test
  (9d8faa7e-a6e2-4791-a188-322f90579aa6) and production
  (16fb4f0b-0f83-4f8c-aa24-82eda9515d36). Both live homepages, JS and CSS
  verified; production passed after a propagation recheck.

- Receipt swirl resized from 32px to 96px (2026-09-09). Build passes; deployed
  to test (7d4f13df-6c63-4f78-aa49-291de1f2855f) and production
  (1b720dd4-7c6e-4fb3-83f2-374514527ef2). Both live homepages and JS assets
  verified to serve index-D7KXsCUP.js.

- Receipt loading indicator (2026-09-09): reuse the cinnamon swirl while the
  WhatsApp link is pending. All 38 tests, lint, and build pass. Deployed to test
  only: f74dca51-3edf-4af0-bee3-f3a5173688a8. Live homepage and updated JS return
  HTTP 200. User approved the test appearance, then approved production.
  Production deployed: b2384bfc-2f24-4800-8ccf-33d3eb12e62d; swirlgirl.sg serves
  the same index-BuRSZVrp.js build (homepage and asset HTTP 200).

- Order latency and receipt fixes completed 2026-09-08: background stock refresh
  with a scheduled backup, immediate receipt, eight-second fallback, cleared
  basket, session receipt recovery, and late-reference updates without retries.
  Verified 38 tests, lint/build, and intercepted slow/error browser flows locally
  and on both deployed sites. No real test orders were submitted.
  Apps Script web app updated to version 28 (not just an editor-source push).
  Production: e172cce7-4bc6-43ed-8402-4ccf1ed16fc0.
  Test: 8fbb11e9-75b4-4ca9-bc12-36c501540098.

- Storefront fixes completed 2026-09-08: exact currency, basket browsing,
  full-screen mobile order form, reference-first WhatsApp link, live bake dates,
  and sticker removal. Allergen acknowledgement and countdown retained.
  Verified 29 unit tests, lint/build, and browser success/failure flows on both
  deployments using intercepted API responses (no real orders created).
  Production: a214e9a6-72a8-49ab-b745-c6d140594002.
  Test: 462ba99e-754c-4fba-a8b0-c24fe4b14fc3.

- `PAY-001`: Current order lifecycle and payment-readiness baseline drafted for
  review.

## Next

1. Review and approve `PAY-001-current-order-lifecycle.md`.
2. Decide the payment provider, payment-confirmation source, and reconciliation
   model before QR or checkout work.
3. Confirm whether email should be required at checkout and what content the
   automatic email should contain.

## Deferred Payment Units

- `PAY-001`: Current order lifecycle and data model.
- `PAY-002`: Payment creation or PayNow QR design.
- `PAY-003`: Persistent payment status model.
- `PAY-004`: Checkout payment UI.
- `PAY-005`: Payment notification ingestion.
- `PAY-006`: Reconciliation endpoint and ambiguity handling.
- `PAY-007`: End-to-end confirmation flow.

## Decisions Recorded

- Google Sheets remains the operational control surface.
- Customer menu reads use Cloudflare KV snapshots instead of direct Sheets
  requests.
- Existing reservation flow uses WhatsApp plus Google Sheets order recording.
- Automated payment confirmation is not implemented or approved yet.
