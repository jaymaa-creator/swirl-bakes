# Sales and customer reporting

In test admin, open **Sales & customers**. This reports existing Orders rows;
it does not record new manual sales or change payment statuses. The test Sheet
remains authoritative. Menu/photo tools remain in the adjacent tab.

Use All time, This month, or a custom inclusive order-date range (Singapore time).
Click Apply / refresh to reread the Sheet. There is no background polling.

- Paid order value: sum of recorded amount_due, falling back to total where
  absent; includes delivery and already-recorded discounts. Paid checkbox or
  legacy Paid status qualifies. Cancelled/refunded rows do not qualify.
- Average paid order: that value divided by paid order count.
- Unique paying customers: customer key/normalised phone identity count among
  paid orders in the selected range. Names are not used for matching.
- Spend per customer: value of identified paid orders divided by those customers.
- Repeat customers: at least two paid orders inside the selected period.
- Returning customers: at least one paid order before the chosen start date.
- Unpaid reservations: shown separately, not treated as paid sales.

Order date is not payment date. This is not profit, cash-flow accounting, or a
bank reconciliation. Missing identity, malformed rows and duplicate references
are disclosed in the data-quality panel. Shared phone numbers represent one
customer identity, not necessarily one individual. Orders missing references
cannot be reliably deduplicated. Rows with unparseable dates are counted across
all history because they cannot be assigned to a date filter.

The test copy contains copied/rehearsal records and must not be used as a live
business total. The initial limit is 10000 order rows and 100 columns. No new
persistent reporting database or customer export is introduced.

## Optional plain-language questions

Future flow: a question such as “How many customers came back this month?”
selects a validated reporting function; code computes the result; an LLM explains
it. No arbitrary database queries or write access. Only aggregate figures go to
the model; customer names, phones, addresses and notes stay out of prompts.

ChatGPT subscriptions and API usage have separate billing. An API-backed website
would require separately configured API billing and a server-side API key.
The dashboard built here requires neither. No API key was created, no API billing
was activated, and no customer records were sent to OpenAI.

Official billing reference (checked 2026-10-26):
https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform
API rates: https://developers.openai.com/api/docs/pricing

Before enabling AI: agree a usage budget and model, enforce limits inside the
application, restrict it to the two admins, keep keys in Worker secrets, and show
source period/freshness with each answer. API dashboard budget alerts alone are
not an application-level spending stop.

## Verification (2026-10-26)

Test Worker `0f534ae3-14b7-4f10-85c0-c527d628830d`, Apps Script v15.
151 tests, lint (one existing unrelated warning), build and public smoke pass.
Owner Chrome verified all-time/month filters, aggregate result and desktop layout.
The copied history reports 15 rows with missing/unrecognised dates and one duplicate;
excluded rows require source review, so totals are not claimed comprehensive.
No Sheet rows were changed. Partner/mobile checks remain unverified.
