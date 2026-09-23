# Project Overview

## Product

Swirl Girl is a mobile-first ordering site for a Singapore small-batch bakery.
Customers browse a Saturday menu, choose a collection or delivery option, and
send a prefilled reservation through WhatsApp. The site also records the order
request in the operator's Google Sheet.

## Primary Goals

- Keep the customer ordering flow quick, clear, and reliable on a phone.
- Let a non-technical operator control products, quantities, availability, and
  bake dates in Google Sheets.
- Publish menu data to a low-latency runtime store so customer requests do not
  depend on Google Sheets being available.
- Keep the system inexpensive and operationally simple.

## Confirmed Customer Flow

1. View the current Saturday menu and availability.
2. Select products and collection or delivery details.
3. Complete the Turnstile check when configured.
4. Open an immediate receipt while a single reservation request is recorded;
   the basket is cleared and the returned reference updates the receipt.
5. Click the receipt's WhatsApp link and send. If the reference is delayed,
   WhatsApp remains available after eight seconds without retrying the write.

If recording fails, the handoff explains that no reference was obtained and
still offers a WhatsApp link. The current site
copy refers to PayNow, but there is no verified automated payment checkout or
payment confirmation implementation in this repository.

## Confirmed Operator Flow

1. Edit product and calendar data in the `Swirl Girl Orders` Google Sheet.
2. Apps Script turns the sheet data into menu snapshots.
3. Apps Script publishes snapshots to the configured production and test
   Worker endpoints.
4. The Worker stores snapshots in Cloudflare KV and invalidates edge cache.
5. The storefront reads the menu from the Worker.

## Out Of Scope Until Explicitly Specified

- Customer accounts and login.
- Card payments or a general payment processor.
- Subscription billing.
- Multi-store fulfilment.
- Replacing Google Sheets with a full inventory platform.
- Broad design-system or framework migration.

## Approved Product Direction For Payments

The desired replacement for the manual flow is:

```text
Select items -> pay -> automatic confirmation -> WhatsApp and email details
```

This is a product direction, not an implementation decision. The current form
does not collect an email address and automated payment confirmation is not yet
implemented. The payment provider, confirmation source, and fulfilment-message
rules must be defined in approved specs before checkout code changes.
