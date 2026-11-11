# Upcoming bake admin dashboard

Open /admin and choose This coming bake. The view keeps a bake visible through
Saturday, even after the ordering cutoff. Choose a bake date to see preparation
quantities, customer/order details, collection slots, delivery addresses and notes.
Cancelled and ambiguous duplicate records do not inflate preparation totals.

Mark paid requires checking the bank first. It updates Paid? and runs existing
referral-credit processing. Mark completed writes the Sheet's existing Closed
status; completion does not itself mean payment arrived.

Delivery orders have Our delivery cost (S$). This is the bakery's driver expense.
Save delivery cost writes a numeric value to Orders.delivery_cost, appending that
column on the first save if needed. Blank means not recorded; zero is allowed.
The value must be from S$0 to S$1,000 with at most two decimal places. Customer
charges, order totals, QR amounts, payment state and stock do not change.
Paid/completed delivery orders can still have their expense recorded.

Writes check the order reference and row revision under the Apps Script lock.
A conflicting or unverified update requires refresh before another write. There
is no automatic retry of writes. Formula-backed delivery-cost cells are protected.

## Release, 11 Nov 2026

User approved production release with “push to prod”. PR #32 merged as
5370c82e69b07fdf7e4e44df49c11bf75c626a9c. Production Apps Script v38 preserves
the existing IncidentDiagnostics helper; test Apps Script v21 remains separate.
Guarded workflow: https://github.com/jaymaa-creator/swirl-bakes/actions/runs/42940207454

190 tests pass locally and in CI; lint/build pass with the existing SwirlGame hook
warning. Mobile fixture checks cover delivery-expense save/reload, zero cost,
invalid precision and conflict/refresh recovery. Live test status writes used only
the existing labelled DO NOT FULFIL test order. No production order/payment/status
or delivery-expense value was changed for verification.

Rollback: previous production Worker 97a931eb-0117-402d-8f7c-6ddb17c1acc1 and Apps
Script v37. Retain any operator-entered delivery_cost values and status updates;
do not undo Sheet data when reverting application code. Full pre-release backend
backup is /private/tmp/swirl-admin-production-backup.

Released Worker: production `da794f86-cb92-4f8a-aaa7-ada0732e825b`, test
`a1dc15d9-01c9-4da0-9627-4e0ff17e06fd`. All release jobs succeeded. Both
production hosts passed storefront/menu/invalid-order smoke. Private API denied
unsigned requests (apex 302 to Access; www 401). Owner Google session verified
Live Sheet details, preparation totals and the delivery-expense input for the
21 Nov bake. Paid/completed buttons remain available. Expense/status production
writes were deliberately not performed; their write paths are covered by tests.
Denied-identity cases are automated; partner login/logout was not repeated.
