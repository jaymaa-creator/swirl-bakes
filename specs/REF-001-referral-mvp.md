# REF-001 — Pickup referral MVP

## Scope

Test environment first. Production must not be deployed until the test flow is
accepted.

## Customer rules

- Give S$5, get S$5.
- Self-collection only, with at least S$35 of bakes before discounts.
- A new customer may enter one referral code at checkout.
- A valid code gives that customer S$5 off their first order.
- The referrer earns one S$5 credit only when that order's `Paid?` checkbox is
  checked in the Orders sheet. A legacy `Status = Paid` edit is also accepted.
- A returning customer's oldest unexpired credit is redeemed automatically.
- One discount per order; a new-customer referral discount takes precedence.
- Credits expire after 90 days and no more than five credits may be earned by
  one referrer in a calendar month.
- Delivery orders do not earn or redeem referral rewards.

## Data and audit rules

- Apps Script is the authority for referral decisions. Browser totals and codes
  are untrusted input.
- Customers are matched by a SHA-256 key derived from their normalized WhatsApp
  number. The referral registry and ledger also retain the normalized WhatsApp
  number so the operator can audit and cross-reference rewards without manual
  decoding.
- Every customer receives a random reusable referral code when their next order
  is recorded.
- `Referral Ledger` is append-only. Earning and FIFO redemption events include
  unique event IDs, timestamps, source/redemption orders, value and expiry.
- Replaying an order request or editing `Paid` repeatedly must not duplicate an
  event.
- Historical orders can prevent a customer being treated as new, but only
  orders carrying the referral-program version may earn referral credits.

## Acceptance criteria

1. Invalid, unknown, self, delivery, repeat-customer and below-minimum referral
   attempts receive no discount.
2. A qualifying new pickup order receives S$5 off and records the decision.
3. Checking that order's `Paid?` box creates exactly one expiring referrer credit.
4. A later qualifying pickup order automatically consumes the oldest valid
   credit and records the redemption.
5. Receipt and WhatsApp text show the server-confirmed amount due and the
   customer's share code.
6. Focused tests, lint and build pass before any test deployment.
