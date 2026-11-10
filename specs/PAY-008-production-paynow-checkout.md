# PAY-008: Production PayNow QR checkout

## Approval and goal

User explicitly approved promoting the tested QR flow to production on
2026-11-10: "ok now lets add the QR payment to prod". This extends PAY-002's
previously test-only scope. It does not approve automatic payment confirmation.

## Scope and decisions

- Preserve current-main storefront, www/apex order fix, admin and order recording.
- After a successful saved SG order, use only the positive authoritative backend
  amount to issue a seven-day short payment link. Include accepted item names and
  quantities, not contact details, address or notes. Reuse the validation menu
  snapshot; do not add another Sheets or menu read.
- Production uses https://swirlgirl.sg/pay#s.<128-bit-random-id>, its existing
  MENU_SNAPSHOT KV, ORDER_WEBHOOK_SECRET with signing purpose
  swirl-production-paynow-v1:, and production:paynow-link-v1: storage prefix.
  Reference P + 24 uppercase SHA-256 hex characters is stable per SG order.
- Preserve test host, secret, prefix, T reference, legacy v1/v2 tokens, short
  links, backend identity check and separate Sheet. Cross-environment tokens
  and order references must fail, even with accidentally identical secrets.
- Recipient remains approved personal PayNow mobile +65 8130 7971. No provider,
  fees, new bindings, migrations, D1 usage or Apps Script deployment.
- WhatsApp draft starts with the short link. Payment page shows items, amount,
  references, Save QR and manual screenshot handoff. Keep TEST warnings only
  in test. Customers wait for bakery confirmation; paid/cancelled checks are
  manual. Generating/saving a QR or sending a screenshot never marks Paid.
- Keep cinnamon loading indicators while the single request is pending, including
  after eight seconds. Retain the explicit unconfirmed-save help handoff. Reload
  or failure must not leave a permanent spinner or retry the order write.
- If optional QR storage fails, retain saved receipt and WhatsApp handoff without
  a QR. Expired/invalid links show no QR and offer a read-only retry.
- Resolver enforces HTTPS host, exact same-origin, method, body limits and JSON.
  Payment routes use no-store, noindex and no-referrer headers; no Sheets lookup.

## Acceptance and verification

- [x] Production and test short links resolve only within their own environment;
  tampering, expiry, malformed data and invalid totals are rejected.
- [x] Saved/duplicate orders use backend amount and stable payment reference;
  failed saves and zero totals produce no QR; KV failure preserves saved order.
- [x] PNG independently decodes to recipient, exact SGD amount, reference and CRC.
- [x] WhatsApp link is first; items/quantity appear in a fresh payment-page session;
  production has no TEST warning; test retains warning; save/download works.
- [x] Pending/delayed loader, late success, failures and reload do not resubmit.
- [ ] Full tests, lint, build, isolated test deployment and both production-host
  smoke checks pass; verify live payment route and matching static artifacts.
- [ ] No new real orders, messages, payments or paid-state writes for smoke tests.
  Physical bank-app import/scan is reported separately if unverified.

## Release and rollback

Release clean current-main-based commit through existing guarded release.yml:
prepare/tests, sealed artifact, isolated test, production approval already given
by the user, production, read-only verification. Apps Script stays v37.
Production rollback Worker e0b31abb-1bce-4299-bcd0-5821a217be43. Test rollback
8709e894-21f6-4bf7-9ecd-292959eb0d45. Rollback disables production link resolution;
existing QR images may still work. Records expire automatically; retain data.
