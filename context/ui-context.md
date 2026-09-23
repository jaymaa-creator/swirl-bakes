# UI Context

## Brand Direction

Swirl Girl is warm, handmade, and distinctly Singaporean: small Saturday
batches from Joo Chiat, rather than a generic ecommerce storefront. The current
palette is brown, cinnamon, cream, and blush. The visual language combines soft
shadows, rounded controls, product photography, and restrained cinnamon-themed
motion.

## Existing Interaction Conventions

- Primary actions use the brand-brown rounded button treatment.
- Menu quantities build a basket without opening checkout. The header or basket
  button opens a full-screen mobile order form (dialog on desktop).
- Availability is server-driven. Do not show a locally guessed bake date while
  the authoritative menu snapshot is loading.
- Loading controls retain their layout and use the existing cinnamon loader.
- Errors should explain the next useful action without blaming the customer.
- Public content should remain concise and readable on narrow screens.

## Future Payment UX Principles

These are design constraints, not an approved implementation:

- Keep a customer on a clear checkout state with the exact amount prominent.
- Do not discard an order because payment detection is delayed or ambiguous.
- Support a realistic same-device PayNow flow, not only a second-device QR
  scan.
- Show an honest waiting, confirmed, or needs-help state; never imply payment
  was received without a verified source.
- Keep future payment UI visually consistent with the current modal, colors,
  typography, spacing, and responsive behavior.
