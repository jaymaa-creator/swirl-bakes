# PAY-001: Current Order Lifecycle And Payment Readiness

## Goal

Document the current reservation flow and establish the constraints for moving
to the approved customer flow:

```text
Select items -> pay -> automatic confirmation -> WhatsApp and email details
```

This is a discovery and design-baseline unit. It makes no production code,
schema, or provider changes.

## Current Lifecycle

1. The frontend reads the menu and availability from `GET /api/menu`.
2. The customer chooses items, fulfilment, name, phone number, and notes in
   `PreorderModal`.
3. The browser builds a human-readable items string and estimated total from
   the rendered menu.
4. After the allergen acknowledgement and Turnstile check when configured, the
   browser opens WhatsApp immediately with a prefilled reservation message.
5. In parallel, the browser posts the order payload to `POST /api/orders`.
6. The Worker accepts order writes only from `https://swirlgirl.sg`, validates a
   small payload shape, optionally verifies Turnstile, and relays the request
   to the Apps Script web app.
7. Apps Script allocates an order number under a script lock, appends a `New`
   row to `Orders`, and attempts to publish a refreshed menu snapshot.
8. The browser adds the recorded order reference to its WhatsApp handoff when
   the asynchronous write succeeds.
9. The operator confirms availability and sends PayNow details manually.

## Existing Data And Authority

- `Products` and `Calendar` in Google Sheets control customer-visible menu
  state through Apps Script-published KV snapshots.
- `Orders` is the current reservation ledger. A non-cancelled order contributes
  to batch stock consumption.
- The browser currently supplies the item summary and estimated total.
- The Worker does not currently own a durable order record or payment state.
- No email address is collected, and no automated email sender is configured.
- No PayNow QR generation, payment notification ingestion, matching logic, or
  automatic payment confirmation exists in this repository.

## Required Design Decisions Before PAY-002

1. Choose the authoritative payment-confirmation source and its permitted
   integration method.
2. Choose where pending orders and payment states live. For automated payment,
   the Worker needs a durable, queryable, idempotent record; Google Sheets can
   remain the operational mirror.
3. Define the exact order states, including expiry, cancelled, payment pending,
   paid, ambiguous payment, and manual-review states.
4. Decide whether email is required, optional, or replaced by WhatsApp-only
   confirmation. Define consent and privacy copy.
5. Define the stock reservation window while a customer is awaiting payment.
6. Define how the Worker recalculates the payable total from the authoritative
   menu snapshot rather than trusting browser text or totals.

## Non-Goals

- Generating a PayNow QR.
- Collecting or processing payment details.
- Writing payment state to Google Sheets or Cloudflare.
- Changing the existing WhatsApp reservation flow.
- Selecting a bank, gateway, email provider, or database without approval.

## Acceptance Criteria

- [x] The current browser, Worker, Apps Script, Sheets, KV, and WhatsApp flow
  is documented from code and operations documentation.
- [x] The immediate WhatsApp handoff and parallel order write are documented.
- [x] The lack of email collection and automated payment confirmation is
  explicit.
- [x] The new customer-flow direction is recorded without treating it as built.
- [x] The decisions required before implementation are explicit.
- [x] No runtime code or live configuration changes are made by this unit.

## Verification

- Reviewed `src/components/PreorderModal.jsx`, `src/lib/orderSubmission.js`,
  `src/worker.js`, and `apps-script/Code.gs`.
- Reviewed `docs/menu-operations.md` and `docs/apps-script-workflow.md`.
- On 2026-08-27, verified deployment metadata with `clasp list-deployments`
  and `wrangler deployments list --name swirl-girl`.
- End-to-end live order creation, menu payload correctness, and Apps Script
  property values are deliberately not claimed as verified by this spec.

## Next Unit

`PAY-002` may be written only after the required design decisions above are
approved. It should cover exactly one payment-creation or PayNow-QR approach,
including recipient details, transaction reference, amount integrity, expiry,
and customer-facing failure states.
