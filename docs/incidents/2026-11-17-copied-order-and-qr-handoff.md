# Copied order and early WhatsApp handoff, 17 Nov 2026

The manually copied SG-0074 row retained SG-0073's Request ID, checkout fingerprint
and Amount Due. The visible Order No and Total had already been changed, so the
admin correctly flagged both rows as ambiguous and displayed the copied S$20.

User authorized making the copied order unique. Repaired only Orders row 60:
new UUID Request ID, cleared the unrelated checkout fingerprint, Amount Due=90
matching its existing Total=90 and zero recorded discounts. Kept order number,
paid/confirmed state, customer identity, items and all other order fields.
Private before/after record: /private/tmp/swirl-order-repair-evidence. Live admin
verified SG-0074 S$90 and SG-0073 S$20 with normal controls and no duplicate warning.

SG-0075 was independently verified saved at S$46. The supplied WhatsApp draft's
request ID matches its Sheet row. Its exact text comes from receiptMessage's
old delayed/unverified fallback, not the normal saved-QR path. The fallback was
available after eight seconds or after an uncertain network result; evidence
cannot distinguish those two timings or prove when the customer left the page.
The order was recorded, but the browser had not confirmed its reference/QR when
that draft was generated. Do not resend the order or infer payment from this.

User now requires the QR link before any generated order WhatsApp message.
Both the message helper and receipt UI require a saved, matching, unexpired QR.
Pending/delayed requests keep the loader and disabled control; failed/unverified
or saved-without-QR receipts retain reference/request ID and plain contact number.
Late success enables a QR-first draft. No automatic order retry or paid changes.

## Released 17 Nov 2026
PR #37, source c4d1d32abb3d24c3658608f824e4fad18a6b18e1; guarded workflow
44079245874 succeeded. Production Worker a7f452e2-236d-4158-a722-f8e7e01020ad,
test aad0df9d-5786-4962-a64b-4d4a7ef289ee. Apps Script remains production v38,
test v21. All 192 tests, lint/build and test/both-host production smoke pass.
Live owner session verifies stock data and date-error/retry recovery, paid totals
and repaired order; unsigned stock API redirects to Access. Phone fixture
verifies early draft blocked, late QR enables draft, stock decisions/review/copy
and refresh persistence. No successful production checkout was created for smoke.
Rollback Worker 5dd8b8cc-e8ae-4097-8d61-e1c36df45007; preserve repaired Sheet data.
