# ADMIN-003: Existing-order sales reporting (test)

## Approved scope
User requests replacement of existing Sheet/Apps Script reporting, using existing
orders only. Read-only Sales tab in Google-protected admin. Sheets remains master.
This expands the earlier migration plan's exclusion of customer-spend analytics.
No manual sales entry, mark-paid controls, payment processing, production release,
customer data export to an LLM, or API billing activation in this unit.

## Definitions
Report by order-created date in Asia/Singapore; payment date is not recorded.
Paid order value: recorded amount_due (fallback total/estimated_total), after
recorded discounts and including delivery, for marked-paid non-cancelled orders.
Not cash received on that date, product-only revenue, profit or audited accounts.
Paid? true and legacy Status=Paid qualify. Cancelled/canceled/refunded orders are
excluded; refunds are not modelled as net cash flows. Invalid date/amount rows and
duplicate order/request references are excluded and counted visibly.

Unique customers are distinct identities on paid orders in the selected period.
Link exact customer keys and normalised phone numbers across historical rows;
local eight-digit Singapore numbers receive +65. Never match by customer name or
substring. Shared numbers are one identity, so counts are an estimate of people.
Missing identity is excluded from customer metrics, but valid order value remains.
AOV = paid order value / paid orders. Spend/customer = identified paid order value /
identified customers. Returning customer = earlier paid order before the period;
repeat-in-period = at least two paid orders inside the period. Empty averages
return null, not a misleading zero. Show denominators and data-quality warnings.

## Data path
Admin JWT -> GET /api/admin/reports -> secret-authenticated isolated Apps Script
adminSalesReport command -> copied Orders sheet -> aggregate-only response.
No names, phones, addresses, notes, customer keys or raw rows leave Apps Script.
No public menu/KV publication. Request on load/filter/explicit refresh, no polling.
Date validation at both boundaries. Maximum 10000 source rows / 100 columns;
fail clearly above the pilot limit. Display source and refreshed timestamp.

## UI and acceptance
Separate Menu/photos and Sales tabs; date range, all-time/month presets, paid
order value, count, unique customers, AOV, customer spend, repeat/returning,
unpaid reservation value/count, monthly trend, data quality and definitions.
Test duplicate/missing/malformed records, phone/key matching, date boundaries,
discounts, paid/cancelled/refunded rules, zero division, auth and test isolation.
Run suite/lint/build and test-only deployment plus read-only live check.

## Future LLM layer
Plain-language question -> approved reporting function with validated dates ->
computed aggregate -> explanation. Do not give the model arbitrary SQL, Sheet
writes, raw customer rows or browser-visible API keys. Keep dashboard independent
of AI. Separate OpenAI API billing, server secret, per-user rate limits and an
application-enforced request/spend allowance are prerequisites for activation.
Confirm model/cost and data disclosure scope before turning it on.

## Rollback
Prior Worker fcaca41a-1986-4edb-bbf4-d2c74556a507 and test Apps Script v13.
No schema changes or data writes to undo. Production untouched.
