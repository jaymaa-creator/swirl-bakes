# Merch: tote bag launch

Requested on 2026-10-10: S$10 tote bags, 10 total units, only alongside bakes.
Fulfilment follows the selected bake order's Saturday pickup/delivery date.

## Operator sheet

The `Merch` tab uses these columns:

| Column | Initial tote value | Meaning |
| --- | --- | --- |
| product_id | tote-bag | Stable unique ID; must not overlap Products IDs |
| product_name | Tote bag | Name used in storefront and order records |
| price_sgd | 10 | Price for one bag |
| available | TRUE | Show this product in production |
| test-available | blank | Optional isolated-test availability override |
| max_quantity | 3 | Existing default per-order quantity limit |
| stock_limit | 10 | Total inventory ever supplied, including restocks |
| description | Add a Swirl Girl tote to your bake order. | Product description |
| per | bag | Sale unit |
| image_url | blank | Optional product photo; otherwise “Photo coming soon” |

`stock_limit` is the number supplied, not the remaining stock. With 10 supplied
and 3 sold, the site shows 7 remaining. Receiving 5 more means setting it to 15.
All non-cancelled order rows count across every date, including future dates.
Cancelling restores availability; reinstating reserves it again. Historical
order rows must be retained for this count. Avoid renaming a product after it
has orders, because existing inventory accounting reads names in order text.

Run `TEST_setupMerchSettings` in the isolated test Apps Script project first.
The setup creates and seeds the tab only if it does not exist; it never clears
or replaces an existing tab. Scripted setup does not trigger an on-edit event,
so run `TEST_syncMenuSnapshot` afterwards. Later manual Merch edits use the
existing publication trigger.

## Ordering rules

- A dedicated Merch section adds totes to the existing basket.
- Choose at least one available bake before adding merch.
- Removing all bakes clears selected merch.
- Both Worker and locked Apps Script validation reject merch-only orders,
  unavailable quantities and changed prices.
- Merch contributes to the order total, but not the S$30 delivery bake minimum
  or S$35 referral bake minimum. Existing delivery fees and referral amounts apply.
- Totes are omitted from recipe ingredient shopping lists.
- No automated payment functionality is added.

## Release and rollback

Local implementation does not create a live tab or deploy either backend.
First deploy the generated isolated Apps Script and Worker, seed the test tab,
publish its snapshot and verify mixed-basket ordering in the copied Sheet.
Deploy matching production code and run `setupMerchSettings` / `syncMenuSnapshot`
only through the existing approved production release process.

An absent Merch tab is supported, so existing menus continue to work. To withdraw
merch, set `available` to FALSE and publish; retain historical orders and the tab.
Rollback must remove merch from published snapshots before reverting the server
rules, so an older server cannot treat merch as qualifying bake spend.

## Test deployment verified on 2026-10-10

The copied test Sheet's Merch tab is seeded and published. Test Apps Script
version 11 and Worker `c28bc419-10b3-414c-9129-c8642286fd75` are active.
All 119 tests, lint, build, generated script parsing and diff checks pass.
Live smoke checks pass; menu reports tote price S$10 and 10 remaining.
Browser checks confirm bake-first selection, mixed totals, bake-only delivery
eligibility and clearing totes when the last bake is removed. The live backend
rejected a tote-only order with HTTP 409 without saving an order. No successful
mixed order was submitted during this verification. Production has no merch.

The remote test backend had a newer native Google Table Paid-checkbox fix and
publication-anchor monitoring fix; these were preserved in local shared source
before generating the new test variant. Previous test backend version 10 remains
available for rollback. The editor-source backup is in the temporary directory
`/private/tmp/swirl-merch-test-backup/`.
