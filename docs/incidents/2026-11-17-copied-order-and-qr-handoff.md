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
