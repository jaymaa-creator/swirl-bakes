# ADMIN-004: This coming bake

## Approval and scope
User requested another admin dashboard for the coming bake on 10 Nov 2026 and
explicitly chose paid/completed updates. This extends ADMIN-003's read-only scope
with an authenticated operational order view and explicit manual actions.
Implement and verify on isolated test first; production release is a separate
final approval. No automatic payment detection, new orders, cancellation, refunds,
unpay/reopen, customer messages, exports or public customer-data storage.

## Data and behaviour
- New This coming bake tab, retaining Sales & customers and Menu & photos.
- Show next scheduled open bake or non-cancelled order bake on/after today's
  Singapore date, including today and dates whose order cutoff has passed.
  Never advance on Thursday cutoff. Allow choosing another known bake date.
- Read Orders and Calendar through existing authenticated Apps Script backend.
  Show customer name/contact, exact recorded items, amount, collection slot or
  delivery address, notes, paid state and completion. No raw rows/customer keys.
- Summary: active orders, unpaid amount/count, completed/pending and quantities
  to prepare by stored item label/unit. Keep banana chip add-ons and merch labels.
  Cancelled/void/refunded/rejected rows are separate and excluded from totals.
  Missing references/duplicate identities/invalid dates, amounts or item text
  are flagged, never silently double counted; unsafe rows cannot be updated.
- Mark paid sets existing Paid? to true only after operator confirms bank receipt.
  Reuse locked idempotent referral-credit processing; never infer payment from QR.
- Mark completed writes existing Status=Closed (live Sheet options checked:
  New, Confirmed, Closed, Cancelled). Completion does not imply payment; preserve
  legacy Status=Paid by carrying it to Paid? before replacing Status.
- Identify by unique order reference and validate full-row revision under script
  lock before any update. Reject stale, duplicate, cancelled or wrong-date rows.
  A repeated desired state is a safe no-op; never auto retry a timed-out write.
  Show uncertain-save error and require refresh before further editing.
- Delivery cost extension approved 11 Nov 2026: editable Our delivery cost (SGD)
  on delivery orders, saved as a numeric expense in Orders.delivery_cost. Add that
  column at the end only on the first save if absent. Blank is not recorded; zero
  is a valid cost. Allow S$0–1,000, maximum two decimal places. Existing values
  load on refresh. Save only this cell under the existing full-row revision lock;
  reject stale, duplicate, cancelled, collection or formula-backed rows. Editing
  paid/completed delivery orders is allowed. Do not modify customer totals,
  delivery charges, QR links, paid state, referral credits or inventory.
- Programmatic paid writes explicitly run referral logic,
  because Sheets edit triggers do not run for programmatic writes. Report
  deferred credit processing truthfully without hiding saved Paid state.

## Security and boundaries
Existing two-admin JWT/Google Access only. Exact production/test host, script
identity, Sheet identity and secret pairing. Same-origin bounded JSON for writes.
Only GET list and POST allowed actions. No-store, noindex; no PII in public KV,
logs, URLs or localStorage. Backend and Worker validate/allowlist responses.
Operator-only Sheets reads do not add a customer runtime dependency.

## Acceptance and verification
- [x] Date selection includes bake day and post-cutoff orders; empty states.
- [x] Accurate item totals, cancellation exclusions, duplicates/quality warnings.
- [x] Paid/completed changes preserve other fields, stock and referral rules;
  repeated requests safe; stale changes and ambiguous saves handled.
- [x] Authentication, same-origin, size, environment and schema tests.
- [x] Full tests, lint, build and generated test Apps Script checks.
- [x] Desktop/mobile browser fixture, isolated live read and safe test-only update.
- [x] Production unchanged until approved; document versions and rollback.

## Release and rollback
Test Worker currently f1631498-785b-42e5-956c-432ce95826bb; Apps Script test v18
(to verify live). Production Worker 97a931eb-0117-402d-8f7c-6ddb17c1acc1,
Apps Script v37. Back up remote source before pushing the generated test variant.
Deploy backend first, then Worker/UI. Reverting UI disables new actions; retain
operator-made status changes. No deletion or automatic reversal of Sheet data.

## Test evidence (10 Nov 2026)
187 tests passed sequentially; parallel execution encountered an existing shared
Vite cache collision. Lint has only the existing SwirlGame hook warning. Build,
generated test backend and diff checks pass. Mobile 390px fixture verified paid,
completed, stale-update rejection and refresh recovery. Live authenticated desktop
view loaded 21 Nov orders; the labelled TEST QR LINK CHECK - DO NOT FULFIL order
was marked paid then completed in the isolated test Sheet. Unpaid count/value and
completed count refreshed correctly. No money moved; production unchanged.
Unauthenticated new API redirects to Access (302); storefront smoke passes.
Test backend v19; previous v18 retained for rollback. Existing Access identities
and configuration unchanged; denied-identity cases covered by automated tests.

Final test Worker: `de6b3baa-37e5-4a33-bed0-f6d3916c1a66` (Apps Script v19).

## Delivery cost extension verification (11 Nov 2026)
- [x] Focused expense validation, schema, concurrency and write isolation tests.
- [x] Full tests, lint, build, test script build and browser save/reload checks.
- [x] Isolated live test deployment and read verification; production unchanged.

Delivery expense test release: Worker `11aedc8f-0458-4f39-8e14-d2ade4d7daef`,
Apps Script test v21. Previous Worker `de6b3baa-37e5-4a33-bed0-f6d3916c1a66`
and Apps Script v19 retained for rollback. Remote v19 editor backed up and
matched the committed baseline before push. Column creation is lazy; no Sheet
schema or real expense values were changed during release verification.
190 tests pass sequentially, lint/build/generated script/diff checks pass with
the existing game hook warning. Mobile synthetic save/reload verified 12.50,
0.00, invalid precision and conflict/refresh recovery; customer amount stayed
35.50. Live authenticated test orders load successfully and storefront smoke
passes. Live expense-cell writes were not exercised: existing coming-bake test
orders are collection orders. Backend tests cover numeric cell writes, first
column creation/grid expansion, full-row revision checks and formula protection.
Production release approved and completed 11 Nov 2026, including the original
ADMIN-004 dashboard. See docs/admin-upcoming-bake.md for versions and evidence.

## Production release (11 Nov 2026)
User approved “push to prod”. PR #32 merged; release 42940207454 succeeded on
5370c82e69b07fdf7e4e44df49c11bf75c626a9c. Production Worker
`da794f86-cb92-4f8a-aaa7-ada0732e825b`, Apps Script v38. Live read verifies
21 Nov preparation and delivery-expense input; no production data edited.
