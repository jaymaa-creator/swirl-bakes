# ADMIN-004: This coming bake

## Approval and scope
User requested another admin dashboard for the coming bake on 10 Nov 2026 and
explicitly chose paid/completed updates. This extends ADMIN-003's read-only scope
with an authenticated operational order view and two explicit manual actions.
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
- No schema change. Programmatic paid writes explicitly run referral logic,
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
