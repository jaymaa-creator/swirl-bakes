# PAY-002: Automatic test checkout QR and WhatsApp payment link

## Approval and scope

User approved automatic QR generation on 2026-11-05 after choosing between
manual PayLah requests and a website-generated QR/payment-page link. This
records that approved unit; production deployment is excluded. The earlier
PAY-001 discovery document describes an older flow and is not this unit's
implementation contract. Automatic payment confirmation remains deferred.

## Flow and decisions

1. Existing validated order submission saves in the isolated test Sheet.
2. Only a successful saved TEST order with a positive server-returned
   `amountDueSgd` receives payment details. Never use the browser quote.
3. Customer opens and sends the prefilled WhatsApp message, labelled TEST,
   starting with the short `/pay#s.<random-id>` link, followed by the order reference.
4. The payment page verifies the token at the test Worker, then shows the
   PayNow QR, exact SGD total, order/payment references, Save QR, bank-app
   photo-import guidance and screenshot-to-WhatsApp action.

Recipient: existing approved personal PayNow mobile +65 8130 7971.
QR generation is local, without a payment provider. Tokens expire after
seven days and contain the test order reference, item names/quantities, amount
in cents and times; no customer contact or address data.
HMAC-SHA256 uses a domain-separated message with the existing test-only
webhook secret; no secret is sent to the browser. Links work across browsers
without sessionStorage. No Sheets query is needed to resolve a link.
Long TEST UUID order numbers get a stable 25-character payment reference
derived from SHA-256; show both references. Replays retain the saved amount
and references, though newly issued links may have later expiry.

## Boundaries

- Preserve order API fields; add `paynow` only in the test entry point.
- Preserve production receipt/WhatsApp behavior. Test WhatsApp simulation is
  replaced with explicit customer-controlled opening/sending; preview still
  intercepts it. Never send messages automatically.
- No payment-state writes, paid claims, notifications, provider integration,
  Apps Script changes, stock changes outside ordinary test ordering, or D1 use.
- Opening WhatsApp, saving a QR or sending a screenshot is not confirmation.
- Link expiry limits access to this page; a previously saved QR can still work.
  No cancellation/paid lookup is implemented. Tell the customer not to pay an
  already-paid or cancelled order and to wait for bakery confirmation.
- Test QR points to a real recipient; clearly warn that paying sends real money.
- Error/expired links show no QR; QR failures retain order/WhatsApp access.

## Acceptance and verification

- [x] Independent PNG decoder verifies payload, fixed recipient, SGD amount,
  stable reference and CRC; no zero/invalid/overprecision amounts.
- [x] Successful test order and duplicate use authoritative backend totals.
  Pending/rejected/delayed/unverified/mismatched receipts get no payment link.
- [x] Tampered, expired, malformed and wrong-purpose tokens fail closed.
  Resolver enforces host, method, origin, content type and size; no writes.
- [x] Payment page survives a fresh browser context and supports save/share
  with download fallback and cancellation; manual confirmation remains clear.
- [x] Production response shape and rendered receipt remain unchanged.
- [x] Focused/full tests, lint, build, deploy guard and deployed smoke pass.
- [x] Browser checkout/payment page checks; actual mobile save/bank scan are
  reported separately if not verified.

## Release and rollback

Deploy only with `npm run deploy:test` and verified `wrangler.test.jsonc`.
Current test rollback Worker version: 9055fd26-3b9f-4912-a32c-4b6381db7ab9.
No migrations or data rollback are required; reverting disables link resolution.

## Release evidence (2026-11-05)

Test Worker `5fa12879-77d3-4593-b782-49014e706a01`; 167 tests, lint/build,
deploy guard and live smoke passed. Browser UI verified at 390/1440px with
intercepted checkout responses; actual live signed page, QR decoding/download,
fresh session, reload and invalid-link handling also passed. One user-requested
DO NOT FULFIL test order exists for S$15.50; no payment or WhatsApp message sent.
Physical phone sharing and bank-app import remain unverified, as permitted by
the device-check acceptance criterion. No automatic confirmation implemented.

## Approved refinement (2026-11-05)

User requests the QR link at the very top of the WhatsApp message and items /
quantities on the payment page. New v2 signed links include a bounded item list
from the accepted structured order and test menu labels (not browser display
text), including banana chocolate-chip add-ons. No customer/contact/address
fields are included. This supersedes the original payment-only token scope.
Existing v1 links stay valid with an honest item-list-unavailable notice.
The delayed/unverified test handoff remains available but is explicitly labelled
as asking for help without a QR; late save completion replaces it with the normal
link-bearing handoff. No retries or production behavior changes.
Verification: first-line URL, signed item tampering/size/type validation,
fresh-session rendered items, legacy links, and delayed-to-saved browser flow.

Refinement verified and test-deployed as
`e90b77a6-e19a-4b90-8df7-1222479bdfb1`: 169 tests; lint/build/guard/smoke pass.
Phone/desktop browser fixtures verify delayed handoff, link first, rendered
items in a fresh session and valid PNG download. Live exact replay confirmed
no new order and a valid signed item-bearing link; old links remain valid.

## Loading and latency refinement (2026-11-05)

User requests the loading icon during the actual order/QR wait and asks to
reduce delay. Keep the existing cinnamon loaders while pending and while a
live delayed request is still running. Track request ownership in React memory,
not sessionStorage: success, failure, rejection and restored receipts must not
keep spinning. Preserve the explicitly labelled delayed help link and the
production eight-second fallback behavior. No artificial minimum wait.

Load the isolated menu snapshot concurrently with the per-order backend identity
check and reuse that snapshot within the same request. Do not cache between
requests or remove identity/locked stock/price checks. No Apps Script change.
Verify loader lifecycle, no resubmission, concurrency, one menu read per request,
freshness on subsequent requests, and wrong-backend refusal.

Loading/latency refinement test-deployed as
`9055fd26-3b9f-4912-a32c-4b6381db7ab9`: 170 tests, lint/build/guard/smoke pass.
Browser fixtures verify a ten-second save with persistent loading and one order
request. Request-count/concurrency tests prove duplicate menu-read removal;
no measured end-to-end speedup is claimed. No Apps Script or production change.

## Short WhatsApp links (2026-11-05)

User requests a compact link because the signed item token dominates WhatsApp.
Ordinary prefilled WhatsApp text cannot mask a URL behind a named hyperlink.
New orders therefore use `/pay#s.<128-bit-random-id>` on the existing test host.
Store the signed token in the existing test KV under
`isolated-test:paynow-link-v1:<id>`, expiring at the token's seven-day expiry.
This adds temporary link storage only, not payment status or a new database.
Await the write before returning the short URL; on failure preserve the saved
receipt and manual WhatsApp handoff without a payment link. Verify the stored
signature and expiry on every resolve. No contact/address data is stored.
Keep legacy signed links valid, keep the short URL first, and retain items/total.

KV can briefly lag across locations. Missing short links explain that a new link
may need a minute; the page offers a read-only Try again action for all errors.
Never retry order submission. No new routes, bindings, Apps Script or production
changes. Rollback leaves expiring records but old code cannot resolve short IDs.
Acceptance: short links stay under 80 characters irrespective of basket size;
awaited writes, failed writes, unknown/expired/tampered records, legacy links,
fresh-browser QR/items, retry recovery and production isolation are verified.

Short-link refinement test-deployed (2026-11-05):
`8709e894-21f6-4bf7-9ecd-292959eb0d45`. 172 tests pass; lint has only the
existing game warning; build, guard and live smoke pass. Browser checks verify
73-character first-line links, items/amount, QR decoding/download, fresh session,
legacy links and missing-link retry without resubmission. Exact replay of the
existing inspection order returned duplicate=true and a working live short link.
No new order, payment, WhatsApp message or production deployment. Physical bank
scan remains unverified. Rollback to `9055fd26-3b9f-4912-a32c-4b6381db7ab9`
will disable short links; their records expire automatically after seven days.
