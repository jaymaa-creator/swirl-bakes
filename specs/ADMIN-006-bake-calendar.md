# ADMIN-006 Bake calendar

Approved for implementation on 24 November 2026.

## Operator workflow

- Add a calendar to `/admin`. Show each Saturday in Singapore time with `Yes`
  or `No` for whether that bake is open to customers.
- Tap a Saturday to turn it on or off and pick the products offered on that
  date. Reuse the existing product names and photos. Each date owns its list,
  so changing a future Saturday leaves other dates as published.
- Start a new date with a copy of the most recent earlier open bake's product
  selection. Copy the selection once, when the operator first sets up the date.
  Reopening a configured date brings back its own saved list. If there is no
  earlier bake, offer the current product catalog with nothing preselected.
- Preview the selected date's menu before publishing. Show when the storefront
  reflects the published date and product selection. Show existing reservations
  before closing a date, and keep them visible after it closes.

## Publishing and fallback

Use the existing authenticated admin workspace and the Cloudflare checkout
database for published bake plans. Reuse existing product IDs and preserve the
current stock calculations and customer cutoff. Google Sheets keeps the order
ledger and a recoverable copy of published bake dates and product selections.
Report backup progress independently from storefront publication. Retry a
failed backup by date and revision without duplicating records. A routine
Sheet sync must preserve plans published in admin. Recovery from the Sheet
must be an explicit operator action.

## Acceptance checks

- An approved admin can edit a future Saturday on a phone. Unauthorized users
  are denied, and the test workspace uses only its own data.
- A fresh Saturday copies the preceding open bake. The new date can carry a
  different selection, and later edits to the source date leave the copy intact.
- Turning a date off removes its ordering entry point. Existing reservations
  remain readable and retain their items, price and status.
- For a published Saturday, storefront and checkout agree on availability
  and respect already reserved stock. Draft edits stay private.
- The published date and selection survive a Sheet sync. Test a failed backup,
  a retry, and recovery from the Sheet in isolation before production enablement.
