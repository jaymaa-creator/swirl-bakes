# 2026-11-10: missing production order and www checkout rejection

## Observed evidence

Operator reported a WhatsApp order from approximately 7–10 November absent
from Orders: one cinnamon box and one sourdough loaf, S$25.50, 21 November
collection. The message has no order reference and still uses estimated total.
Searches of the actual production Orders tab by first name, surname and phone
found no match. Customer contact details are intentionally omitted here.

Production `swirlgirl.sg` and `www.swirlgirl.sg` both serve the same storefront
asset (`index-BLiMbIn8.js`) and the November 21 menu. Safe empty-body probes:

- `https://swirlgirl.sg/api/orders`: HTTP 400, Invalid order request.
- `https://www.swirlgirl.sg/api/orders`: HTTP 403, Orders are disabled on this preview site.

The Worker allows only the apex host even though www is a public storefront.
This rejects all www orders before menu checks, Apps Script or Sheet writes.
The frontend classifies the response as unverified and offers a WhatsApp draft
that looks ordinary, without mentioning that storage was not confirmed.
An eight-second delay or other uncertain failure can produce the same draft.
We cannot attribute this customer's failure to www without the original URL or
request evidence. No claim is made that every recent order failed.

Live Worker: `0e89f827-a508-45bb-a287-e85f080f4d07`; latest main `938eb76`.
The production KV monitoring record's latest orderRelay event remains
2026-10-01T13:24:35.720Z. This is only the most recent throttled event per
category, not a per-request audit. Host rejections do not enter that record.
Absence of a recent event does not prove there were no failed orders.

## Focused repair

- Permit exactly `swirlgirl.sg` and `www.swirlgirl.sg` for the production order
  endpoint. Keep exact same-origin checks, preview restrictions, test isolation,
  authoritative totals, idempotency, Turnstile and locked backend validation.
- Prefix reference-less WhatsApp drafts with an explicit request to check
  whether the order exists in the Sheet. Include the existing valid request ID
  for matching an eventual saved row. Keep all order details and the eight-second
  help fallback; do not automatically resubmit or claim that a timeout proves loss.
- Label the unconfirmed receipt action “Ask us to check this order”. Successful
  receipts keep their existing reference-bearing WhatsApp messages.
- Smoke-check both public production hosts so the www defect cannot pass a
  release checked only on the apex hostname.

No payment changes, Apps Script edits, schema changes, customer messages or
real customer order writes. This does not import the test-only PayNow work.

## Verification and release

Regression tests reproduce the original www rejection and ambiguous handoff
before the fix. Test the reported basket shape with synthetic contact details,
including a French-format phone and the mixed-case Sourdough ID, on both hosts;
verify previews and cross-origin requests remain rejected. Test delayed and
failed receipt drafts and late successful save behavior. Run full tests, lint,
build and browser fixtures without live order writes before release.

Production deployment requires the guarded release approval. Preserve the
current test-only QR implementation when arranging test deployment; do not
silently overwrite that work with the production branch.

## Customer reconciliation

The missing order is not automatically recovered by this code repair. Check
whether the operator has since entered it, then reconcile one reservation for
November 21, 11am–12pm collection, cinnamon box x1 and sourdough x1, S$25.50.
Do not assume payment, create a duplicate, or ask the customer to reorder.
No customer/stock/payment/referral records were changed during investigation.

## Local verification result

161 tests pass; lint has zero errors and the existing SwirlGame hook warning;
production build and diff checks pass. Native Chrome on the localhost build
verified cinnamon + sourdough at S$25.50, international contact input, waiting
state and a simulated failed-save handoff containing the explicit warning,
request ID and intact order details. The local server returned fixture responses
only and made no external order writes. Unit tests cover late success and both
hostnames. No live successful order or deployment was performed. The repair is
ready for guarded release approval, not yet released.
