# Referral production readiness (2026-09-30)

This is a preparation record, not a production enablement instruction. REF-001
requires an accepted test flow before production deployment. The shared
`apps-script/Code.gs` is the production source, but its referral changes are
currently only deployed through the generated, guarded test script. The
production Apps Script deployment and Worker must remain on their existing
versions until the gates below pass.

## What changed

- Checkout accepts an optional referral code; the Worker validates its shape
  and passes it through without trusting browser prices.
- Apps Script assigns a random reusable code to each normalized WhatsApp
  number. The registry stores a customer key and the phone number.
- A new qualifying pickup customer receives S$5 off a S$35 or larger food
  order. Checking `Paid?` on that recorded order earns the referrer S$5.
- A returning qualifying pickup customer automatically uses their oldest
  unexpired S$5 credit. Earning and redemption are recorded in an append-only
  ledger. One reward is applied per order.
- Test has a separate Sheet, Apps Script project, secret, Worker entry, and KV
  namespace. Test receipt WhatsApp handoff is simulated.
- Orders now fill the first blank `Order no` row, copy the preceding row's
  format and validation, and explicitly insert an unchecked `Paid?` checkbox.

## Verification to date

- Local: 107 tests, lint, production build, generated test-script parsing and
  diff whitespace checks passed after the ledger recovery and receipt changes.
- Isolated live test: generated referrer code, applied a S$5 friend discount
  (S$41 to S$36), created a credit after the friend order was marked paid,
  and redeemed that credit on the referrer's next S$40 order (S$35 due).
- On 2026-10-01, a fresh isolated S$40 pickup order received S$5 off and was
  saved as `TEST-dc01361e-310c-45c2-96b7-9f15a588a2a1`. Its `Paid?` edit
  created one S$5 `CREDIT_EARNED` ledger event; unchecking and rechecking did
  not duplicate it. The test receipt's WhatsApp simulation revealed Bun Bounce
  without sending a real message. The copied test Table's `Paid?` column needed
  checkbox formatting applied; future-row inheritance is not yet proven.
- A WhatsApp draft could show both the server-confirmed discounted amount and
  the old browser estimate. The stale estimate is now omitted for saved orders
  with an authoritative amount. All 107 tests, lint, and build pass; isolated
  test Worker `6460ee0f-6d30-4aca-829f-2c2a61fbc354` passed smoke checks.
- Read-only production checks on 2026-10-01 confirmed the `Paid?` checkbox
  column, one active `onMenuSheetEdit` trigger, Apps Script web app version 31,
  and homepage/menu/invalid-order smoke results of 200/8 products/400.
- Read-only production baseline on 2026-09-30: homepage HTTP 200, eight menu
  products, malformed order HTTP 400. This does not validate the referral path.

## Release gates

1. **Ledger/order recovery.** The order row now commits the decision before the
   ledger event is appended. A saved row reserves the source credit, and a
   missing event is rebuilt on replay or the next order. Local failure/retry
   tests pass. The isolated live friend-discount and paid-credit path is now
   confirmed; a deliberately failed live ledger append has not been induced.
2. **Production Sheet/Table layout.** The visible `Orders` table has a `Paid?`
   checkbox column and Status/collection dropdowns, but currently ends at row
   40. The next order will land at row 41 outside the Table; Apps Script now
   explicitly inserts its `Paid?` checkbox. Table membership itself still does
   not auto-expand, so the operator should review the row-41 UX after launch.
   Google Sheets Tables do not automatically expand from ordinary Apps Script
   writes; copying cell validation is a fallback, not Table membership.
3. **Manual paid trigger.** Production has exactly one installed
   `onMenuSheetEdit` trigger. No real production paid edit has been performed;
   verify the first qualifying paid order against the ledger after activation.
4. **Customer-facing failures.** Known sold-out or price-change rejections now
   say the order was not recorded, hide WhatsApp handoff, and reload the menu.
   This is deployed to the isolated test Worker; verify the rendered browser
   flow there before production release. Uncertain network failures retain the
   existing check-before-reordering guidance.
5. **Test cleanup.** Previous test orders consumed visible stock. Delete only
   clearly labelled test rows when intended, then run `TEST_syncMenuSnapshot`
   and recheck the live test menu. Clearing Orders alone leaves referral
   registry and ledger events intact.

## Safe sequence after blockers are resolved

1. Freeze and review the exact source diff, including unrelated untracked
   artwork. Do not include those assets in a referral release.
2. Run all local checks; deploy the exact code to the isolated test script and
   Worker; repeat one controlled referral, paid, redemption, and failure/retry
   rehearsal. Record order IDs and restore test availability afterward.
3. Back up the production Sheet and Apps Script deployment identifiers. Check
   the production headers and installed trigger without changing customer data.
4. Deploy a new production Apps Script web-app version and confirm its health.
   Then release the matching Worker/static asset via the reviewed exact-commit
   workflow and its production approval gate. The Worker alone cannot activate
   the referral behavior because Apps Script makes the financial decision.
5. Monitor first real orders and compare order totals, paid state, and ledger
   events. Roll back both Apps Script and Worker if they diverge; Worker rollback
   alone does not undo Sheet or ledger changes.

No production referral secrets or additional Cloudflare bindings are required
by the current design. No production referral data, settings, or deployments
were changed while preparing this record.
