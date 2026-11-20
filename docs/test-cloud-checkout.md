# Isolated Cloudflare checkout

The test storefront sends an order when the customer confirms the WhatsApp handoff. Customers can open the order form and review their basket before pressing the place-order button. A successful response means the isolated Cloudflare database (D1) has saved the order. It does not confirm that a message was sent or a payment received.

The test Sheet publishes menu prices, stock, existing request identities and referral eligibility to the test Worker. The Worker calculates the exact basket total, applies delivery and eligible discounts, and creates the QR for that order. A single database insert saves its reference, QR link and reservation against the menu version used for pricing. Concurrent purchases retry against the updated stock. An exact request retry returns the saved receipt.

## Ledger delivery

The Worker sends saved orders to the isolated Apps Script in the background. The script locks the Sheet, checks the request ID and fingerprint, and appends the order once. A five-minute scheduled task also checks for pending orders, claiming up to three per invocation. An idle, initialised checkout checks D1 only. The detailed delivery record is erased after acknowledgement. Stock and credit reservations remain in place until a fresh Sheet publication includes the matching order.

## Test operations

Use only the Worker and database in `wrangler.test.jsonc`, and the script generated for `.clasp.test.json`. The schema is in `test-checkout/schema.sql`. See `docs/test-apps-script.md` for script deployment. Run `npm run deploy:test` and `npm run smoke:test` for the isolated Worker.

Check outstanding ledger writes with `SELECT COUNT(*) FROM checkout_orders WHERE delivered=0`. Check outstanding reservations with `SELECT COUNT(*) FROM checkout_orders WHERE reserved IS NOT NULL`. If either count persists after retries, check the isolated script identity, secret and publisher, then compare the request ID, fingerprint and receipt reference before replaying anything.

To switch the test writer back to Apps Script, pause new test orders, drain pending writes, confirm both counts are zero and publish the current test menu to KV. Then disable `TEST_D1_CHECKOUT` and redeploy the test Worker, keeping its D1 binding and tables for existing short links.
