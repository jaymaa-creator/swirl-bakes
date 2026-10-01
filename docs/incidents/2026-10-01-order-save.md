# 2026-10-01: production orders failed before saving

## Impact and cause

At least two valid customer requests failed to create Orders rows on 1 October.
The customers continued through WhatsApp, according to the operator. The exact
customer/order details must be reconciled from those messages; they are not
recoverable from the generic monitoring events. No assumption of payment is safe.
Missing Orders rows also mean stock and referral eligibility can be incomplete.

The referral release introduced an unconditional `Range.insertCheckboxes()` on
each new row's `Paid?` cell. Production uses a **native Google Table typed column**.
Google rejects that operation with:

```
Exception: This operation is not allowed on cells in typed columns.
    at appendOrderRow (Code:820:66)
```

It ran before `setValues()`, so a presentation operation prevented order storage.
A disposable copy of the actual production Orders tab reproduced this exact
exception. Native typed cells returned `null` from `getDataValidation()`, so a
simple "only insert if there is no validation" guard would still have failed.

`doPost` caught the exception and returned `ok:false`. An Apps Script execution
marked "Completed" was therefore **not evidence of a saved order**. The Worker
correctly recorded `orderRelay` failures. Referral customer creation and reference
allocation had already happened, leaving customer records without saved orders.
Those records are retained for reconciliation, not silently deleted.

## Timeline (Singapore time, 1 October)

- The production release deployed Apps Script web-app version 32.
- 19:47:20: one `doPost` execution began; Worker relay failure at 19:47:34.773.
- 21:23:43: another `doPost` execution began; relay failure at 21:24:35.720.
- Alerts arrived later than the recorded failures (approximately 19:53 and 21:38).
  User-reported WhatsApp times were before 20:00 and around 21:40.
- 22:58–23:00: a disposable production-table copy reproduced the typed-column
  exception; the probe removed its own copy after each run.
- 23:05:58–23:06:04: patched writer passed the same real-table probe, including
  saved request/reference, `Status=New`, and boolean `Paid=false` assertions.

The live Orders table still ended at row 41 during diagnosis. The two Worker
events are a lower bound, not a complete impact census: monitoring keeps the most
recent event per category, not a durable per-request order recovery queue.

## Why test passed and production failed

This was a release-verification gap, not proof that Google Sheets is unreliable.

1. Test and production shared source, but their Sheet/table schema was not proven
   equivalent. Earlier test troubleshooting involved row placement and checkbox
   handling. Successful test writes did not establish compatibility with the
   production typed `Paid?` column. The precise historical test-cell state was
   not captured, so its exact difference cannot now be asserted with certainty.
2. Our automated Sheet fake made `insertCheckboxes()` always succeed. It did not
   model Google's typed-column restriction or native validation returning null.
3. Production smoke submitted an invalid order and expected HTTP 400. That tests
   rejection, not successful persistence; it never reached `appendOrderRow`.
4. Worker deployment and Apps Script deployment are separate, and the workflow
   attested a numeric Apps Script version rather than testing its successful
   write path against the real production table schema.
5. The broad Apps Script catch called runtime faults "Invalid order payload".
   Monitoring detected the failure but did not identify the failing stage in the
   alert, increasing diagnosis time.

The release was called ready without enough evidence for the production write
path. Responsibility sits with the implementation and release checks, not the
operator's approval.

## Repair

- Preserve existing ordinary checkbox validation. For native typed columns,
  tolerate only Google's specific `insertCheckboxes` restriction and write the
  boolean order value normally. Other exceptions still propagate. Do not alter
  the Table schema, dropdowns, existing paid flags or existing order statuses.
- Allocate new `SG-` references above both the stored sequence and the highest
  existing numeric reference while holding the existing order lock. A manually
  entered reference had outrun the stored sequence; this is a separate collision
  risk, not the cause of the checkbox exception.
- Remove the monitor's comparison of the snapshot's publication anchor with the
  current batch. After Thursday's 22:00 cutoff, the live menu dynamically selects
  the next batch from the same bundle. Continue comparing the **actual live menu**
  batch, calendar, price and stock with fresh Sheets data. The raw anchor mismatch
  was a separate false positive, not the evening order-save cause.
- Add regression tests for native typed columns, ordinary checkbox validation,
  unrelated errors, full save/replay under typed-column rejection, manual order
  numbering, and cutoff rollover (including genuine live mismatch detection).
- Retain `diagnoseOrderWrite()` as a manual production-schema probe: it copies
  Orders inside the same spreadsheet, writes only synthetic data to that copy,
  asserts persisted identity/status/paid=false and deletes only its own copy.
  It neither allocates a production reference nor modifies Orders/referral/stock.
  It rethrows failure so a failed probe is visibly Failed, not Completed.

## Required gates next time

For any change to order persistence, checkbox/dropdown handling or Sheet schema:

1. Run tests, lint, build and the generated test-source parity check.
2. Run a successful isolated checkout and exact-request replay; verify one row,
   correct total, boolean unpaid value, no duplicate referral events and stock.
3. Run the candidate writer against a disposable copy of the actual production
   Table. Never "fix" the fixture into a plain range to make a test pass. Verify
   dropdown/checkbox UX and types, not just visible values.
4. Record the exact Git SHA, Apps Script version/deployment and probe evidence.
   Source upload alone does not update the live `/exec` deployment.
5. Perform post-deploy read checks and reconcile the first authorized real saved
   order. Homepage/menu/HTTP-400 smoke alone must never be labelled end-to-end.
6. Keep rollback scoped: reverting to version 32 would reintroduce this defect.
   Prefer the tested forward repair; review any older backend against referral
   data before rolling it back.

## Remaining work and limits

- Reconcile the two original WhatsApp orders, their payment state and stock;
  check for other affected orders. Preserve request identity where available and
  prevent duplicate credit. Do not ask customers to place the same order again.
- Add privacy-safe per-request stage/error codes and durable failure correlation
  in a separate scoped change; do not log customer payloads or secrets.
- Automate the real-table schema probe/release attestation. The probe and release
  checklist exist now, but no claim is made that CI can run authenticated Google
  spreadsheet writes automatically.
- Consider a durable order recovery queue separately. This hotfix does not add
  one and does not change payment functionality.

Deployment and final verification evidence is recorded below as it completes.
