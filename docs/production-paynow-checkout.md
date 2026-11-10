# Production PayNow checkout

Approved 10 November 2026 (PAY-008). After the order is saved, the receipt offers
WhatsApp with a compact payment link first, then the normal order details.
The customer sends that draft, waits for bakery confirmation, opens the link,
and saves/scans the QR for the exact recorded total. The page includes item names
and quantities. Payment is still checked manually in the bank and Sheet.

Production links use `https://swirlgirl.sg/pay#s.<random-id>` (49 characters).
They last seven days, work on another device and do not require browser storage.
Both apex and www checkout work; generated payment URLs use the apex host.
The QR recipient is +65 8130 7971. The stable P-prefixed payment reference and
normal SG order reference both appear on the payment page.

The page cannot check whether an order was paid or cancelled. Confirm the order
before requesting payment, and check the bank before marking Paid. Sending a
screenshot or opening a QR does not update payment status. Expiry stops the page
from resolving; a previously downloaded QR may still work.

If the order is still saving, the receipt keeps its cinnamon loader. After eight
seconds the existing help handoff remains available and explicitly asks for a
Sheet check. It does not retry the write. If optional link storage fails after a
successful save, the normal recorded-order WhatsApp handoff remains available.
Missing/expired links offer Try again (read-only) and WhatsApp help.

## Environment boundary

Production: Worker `swirl-girl`, existing MENU_SNAPSHOT namespace
`72bd2fca38124ec8bd538b008f9bad95`, `production:paynow-link-v1:` records,
`swirl-production-paynow-v1:` signing purpose with existing ORDER_WEBHOOK_SECRET.
Test: Worker `test-swirl-girl`, namespace `dd1d03c666db445299adbf64c0cc4630`,
unchanged `isolated-test:paynow-link-v1:` / `swirl-test-paynow-v1:` and separate
TEST_ORDER_WEBHOOK_SECRET. Test retains its real-money warning, TEST order
references, T payment references and compatibility with existing long links.

Temporary KV records contain signed order reference, item names/quantities,
amount and expiry only. They contain no customer name, phone, address or notes.
No new binding, D1, payment provider, Apps Script deployment or Sheet schema.
The production order path reuses the menu snapshot already used for validation.
The test path retains its per-order backend identity check and concurrent menu
read. No extra Sheets call is made to generate or resolve a payment link.

## Verification and rollback

Local: 178 tests, lint (existing SwirlGame hook warning), production build and
deployment guard pass. Independent PNG decoder checks recipient, amount,
reference and CRC. Browser fixtures verify production item list, first-line
short link, delayed loader, late save native QR sharing/cancellation, read-only retry and PNG download. The browser
download was independently decoded and matched the expected payment payload.
Physical bank-app scan/import is not verified; no real payment was made.

Use the existing exact-commit release workflow and sealed static artifact.
Production rollback: `e0b31abb-1bce-4299-bcd0-5821a217be43`.
Test rollback: `8709e894-21f6-4bf7-9ecd-292959eb0d45`.
Rollback disables production links; keep expiring records and order data.

## Released 10 November 2026

Source `302826a9e93db3d782ca9fe9fc253fdfcf5e7b8a`, PR #30.
[Guarded release 42771662946](https://github.com/jaymaa-creator/swirl-bakes/actions/runs/42771662946)
passed all stages. Production Worker `97a931eb-0117-402d-8f7c-6ddb17c1acc1`;
test Worker `f1631498-785b-42e5-956c-432ce95826bb`; Apps Script remains v37.
Both production hosts pass smoke and payment privacy/error/isolation checks;
JS/CSS and payment-page chunk match the sealed release artifact byte for byte.
The pre-existing test short link returns identical item, amount and QR data and
renders correctly in Chrome. Production invalid-link UI verified live.
Production saved-order QR issuance was fixture-tested; no real order was placed
or replayed for this release. No messages, payments or paid-state writes.
