# Swirl Girl Menu Operations

This guide explains how the website menu, stock limits, Google Sheet, and Cloudflare cache work together.

## Everyday Use

The `Products` tab is the source of truth for what can be ordered. The `Orders` tab records reservations and reduces remaining stock for the active Saturday batch.

To change the live menu, edit the relevant row in `Products`. No website code change is needed.

| Column | What it controls |
| --- | --- |
| `product_id` | Unique product name used by the website, for example `banana-bread`. Do not change it after orders exist. |
| `price_sgd` | Customer-facing price in Singapore dollars. |
| `available` | Manual on/off switch. Use `TRUE` to sell the product and `FALSE` to show it as sold out. |
| `max_quantity` | Maximum one customer can reserve in a single order. |
| `batch_limit` | Total quantity available for the current Saturday batch. Leave blank only if there is no batch-wide stock limit. |
| `description` | Optional customer-facing product copy. If blank, the website uses its existing copy for recognised products. |
| `allergens` | Optional customer-facing allergen statement. |
| `image_url` | Optional product image URL. |

## Stock Calculation

For the active Saturday batch, the menu calculates:

```text
remaining quantity = batch_limit - quantity in non-cancelled Orders rows
```

The highest selectable quantity is:

```text
minimum of max_quantity and remaining quantity
```

Examples:

- `batch_limit = 4`, `max_quantity = 2`, and three items already ordered: only `1` can be selected.
- `remaining quantity = 0`: the product is shown as sold out, even if `available` is `TRUE`.
- `available = FALSE`: the product is shown as sold out regardless of its remaining quantity.

Orders with a status of `Cancelled`, `Canceled`, `Void`, `Refunded`, or `Rejected` do not consume stock.

## Fast Menu Snapshot

Visitors read the menu from Cloudflare KV, rather than waiting for Google Sheets. This normally responds in a fraction of a second.

```text
Products or Orders edited
  -> Apps Script recalculates products and remaining stock
  -> Apps Script publishes a signed snapshot to Cloudflare KV
  -> website serves the new snapshot
```

The `MENU_SNAPSHOT` KV binding is declared in `wrangler.jsonc`. Cloudflare provisions and keeps this resource during Git deployments. Do not remove that binding.

Changes usually appear within a few seconds. Cloudflare KV is globally replicated, so allow up to one minute for every location to see a new value.

## Manual Refresh

Use this only if you have made a Sheet change and want to force a refresh immediately.

1. Open the Google Apps Script project.
2. Select `syncMenuSnapshot` from the function dropdown.
3. Click **Run**.
4. Check the Execution log for a completed execution without an error.

The project also has an installed `onMenuSheetEdit` trigger. It automatically refreshes the snapshot when someone manually edits either `Products` or `Orders`.

Website orders refresh the snapshot after the order is written to the `Orders` tab. A failed refresh never rejects a successfully saved order; run `syncMenuSnapshot` if needed.

## Setup Values

Google Apps Script **Script Properties** must contain:

| Property | Purpose |
| --- | --- |
| `ORDER_WEBHOOK_SECRET` | Shared secret for authenticated website orders and menu updates. Keep private. |
| `MENU_SNAPSHOT_URL` | `https://swirl-girl.jaemcd95.workers.dev/api/menu/sync` |
| `ORDER_SEQUENCE` | The latest order number counter. Do not reset it. |

The Cloudflare Worker must have an `ORDER_WEBHOOK_SECRET` secret with the same value as Apps Script. If the secret is rotated, update it in both places and never paste it into chat, code, or Git.

## If Something Looks Wrong

| Symptom | What to do |
| --- | --- |
| A product is missing | Check that its `product_id` is filled in and `available` is `TRUE`. |
| A product should be sold out | Check `batch_limit`, the current Saturday batch in `Orders`, and the order status. Then run `syncMenuSnapshot`. |
| A price has not changed | Confirm `price_sgd` is numeric, then run `syncMenuSnapshot`. |
| The live menu fails to load | Run `syncMenuSnapshot`. If it errors, check that `MENU_SNAPSHOT_URL` and the matching shared secret still exist. |
| Order number looks wrong | Check `ORDER_SEQUENCE`; it should be the last issued numeric sequence. |

## Technical Maintenance

Apps Script source is versioned in `apps-script/`. Use `clasp` to publish it after changing that code. The normal website Worker deploys automatically after a push to `main`.

Before deploying a code change locally, run:

```bash
npm test
npm run lint
npm run build
```
