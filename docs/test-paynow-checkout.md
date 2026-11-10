# Test checkout PayNow QR

Approved scope: `specs/PAY-002-test-paynow-checkout.md`. Test host only:
https://test-swirl-girl.jaemcd95.workers.dev

## Try the flow

1. Choose bakes and submit the test order form.
2. Once the order reference is saved, select **Send via WhatsApp**. The draft
   starts with the payment-page link and is labelled TEST. Sending is manual.
3. Open that link (or **View payment QR** on the receipt). It also works in a
   fresh browser without the original receipt/session.
4. **Save QR** opens supported phone sharing options, with PNG download as a
   fallback. Import the saved image using the bank app's Scan & Pay photo option.
5. Verify recipient and amount. The QR uses the real PayNow mobile
   +65 8130 7971, so do not complete a payment merely to test the checkout.

The payment screenshot button opens a WhatsApp draft. The customer attaches
the bank confirmation image and taps Send. No action marks an order paid.

## Implementation boundaries

- `src/testWorker.js` enriches the final successful order response, after
  existing backend identity and order validation. Only TEST references and
  positive, cent-exact `amountDueSgd` values qualify. Replayed orders retain
  the saved total and stable payment reference.
- `src/paynowTest.js` signs payment and item-summary data with HMAC-SHA256, using a
  purpose prefix and the existing `TEST_ORDER_WEBHOOK_SECRET`. Only the test
  Worker imports this module. No new secret, Apps Script or payment status
  integration is introduced. Short links use the existing isolated test KV.
- New URL fragments contain only `s.` plus a random 128-bit reference (73
  characters for the full test URL). The signed token is saved in test KV at
  `isolated-test:paynow-link-v1:<id>` with the same seven-day expiry. Await the
  write before offering a link; failed writes leave the saved receipt intact.
  `/api/paynow/resolve` reads the token and verifies its signature/expiry. It
  never reads Sheets or writes anything. Tokens contain items/quantities but
  no customer name, address or phone. Legacy signed fragment links still work;
  v1 links explain that their item list is unavailable.
- Ordinary prefilled WhatsApp messages cannot hide a URL behind named text.
  The compact URL is kept at the top of the draft. Existing sent messages and
  restored receipts keep their original URL; newly saved orders use short links.
- KV may briefly lag across locations. A missing record explains the possible
  delay/expiry and offers Try again; this only rereads payment details and never
  resubmits an order. Invalid signatures or expired tokens never produce a QR.
- Links expire after seven days. This does not revoke a previously saved QR.
  Cancellation and actual payment status are not looked up; bakery confirmation
  and manual checking remain necessary.
- Long TEST order IDs have a stable 25-character payment reference: `T` plus
  the first 24 hexadecimal SHA-256 characters of the full order ID. Both are
  shown together. This fits the QR bill-reference field.
- Zero, malformed and uncertain orders retain the existing manual handoff
  without a payment link. QR/signing failure does not invalidate a saved order.
- Production Worker and Apps Script are unchanged. Default production receipt
  text is preserved; only the test receipt opens actual WhatsApp drafts now.

## Verification

`npm test`, `npm run lint`, `npm run build`, `git diff --check`, then
`npm run deploy:test` and `npm run smoke:test`.

Tests independently decode a generated PNG and verify PayNow fields and CRC;
exercise amount validation, token tampering/expiry/purpose, host/origin/body
limits, saved-order and replay enrichment, receipt states, production exclusion,
save/share cancellation and download fallback.

Browser rehearsal uses intercepted orders and backend fixtures (no real
orders/messages/payments). It checks the actual built UI at 390/1440 pixels,
receipt reload without resubmission, the WhatsApp link, a fresh payment-page
session, browser-generated PNG decoding, downloaded filename and invalid-link
errors. Physical iPhone/Android save behavior and a bank-app scan require
device checks; a decoded QR is not evidence of bank acceptance or payment.

Rollback: deploy the previous test Worker version
`c72e3e09-2d33-4c59-95a5-7b5bd09b035b`. No data migration was made. Old links
will stop resolving after rollback. Preserve existing secrets and bindings.

## Deployed test version

On 2026-11-05: `5fa12879-77d3-4593-b782-49014e706a01`. All 167 tests passed;
lint has the existing SwirlGame hook warning; build and live smoke passed.
The user-requested inspection order is
`TEST-4b8e590b-a67e-4c74-9082-407dc3334e58` (S$15.50, 21 November test batch,
one cinnamon box, DO NOT FULFIL). It remains in the isolated ledger and uses
one test stock unit. Its link expires 12 November at 14:41 Singapore time.
Live link resolution, rendering, PNG download/decode, reload and invalid-link
handling passed in desktop Chrome at phone viewport size. No bank transaction
or WhatsApp send was performed. Physical bank-app import is still outstanding.

Refinement: while the order is delayed/unverified, the test receipt labels the
backup WhatsApp action as “Ask us to check this order — no QR yet”. A late
successful save updates that same receipt to the normal link-bearing handoff.
The website cannot update a message already sent in WhatsApp; reopen the
receipt's WhatsApp action once the QR is ready. No automatic resubmission.

Latest refinement deployment (2026-11-05):
`e90b77a6-e19a-4b90-8df7-1222479bdfb1`. 169 tests, build, guard and live smoke
pass; lint has only the existing game warning. Browser checks cover delayed
save -> ready handoff, first-line QR URL and signed item rendering. An exact
replay of the earlier inspection order returned duplicate=true with the same
amount/reference and a new link carrying items. No additional test order was
created. Roll back this refinement to
`5fa12879-77d3-4593-b782-49014e706a01` if needed.

Loading/latency refinement (2026-11-05): test version
`9055fd26-3b9f-4912-a32c-4b6381db7ab9`. The cinnamon loading animation remains
visible for a live delayed order request, alongside the clearly labelled help
link. It stops on completion/failure; a reloaded receipt does not imply that a
request is still running. No fixed minimum wait or automatic resubmission.
The test Worker now overlaps its fresh menu read with backend identity checking
and reuses that read within the request. All isolation/stock/price checks remain;
there is no cross-request menu cache. 170 tests and live checks passed; total
checkout latency improvement has not been benchmarked. Larger savings require
separate profiling of the Apps Script/Sheets save path. No new test orders were
created. Rollback: `e90b77a6-e19a-4b90-8df7-1222479bdfb1`.

Short-link refinement test-deployed (2026-11-05):
`8709e894-21f6-4bf7-9ecd-292959eb0d45`. 172 tests pass; lint has only the
existing game warning; build, guard and live smoke pass. Browser checks verify
73-character first-line links, items/amount, QR decoding/download, fresh session,
legacy links and missing-link retry without resubmission. Exact replay of the
existing inspection order returned duplicate=true and a working live short link.
No new order, payment, WhatsApp message or production deployment. Physical bank
scan remains unverified. Rollback to `9055fd26-3b9f-4912-a32c-4b6381db7ab9`
will disable short links; their records expire automatically after seven days.
