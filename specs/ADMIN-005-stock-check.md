# ADMIN-005: Restore ingredient stock checker to admin

User reported the missing admin stock checker on 17 Nov 2026. The legacy kitchen
checker remains test-only at /stock; ADMIN-001 originally excluded stock tools.
This extension adds Stock check inside the existing authenticated admin workspace.

Reuse have-enough / need-to-buy swipe cards, review, undo and copy shopping list.
Google admin login protects the new /api/admin/stock route; no password shortcut
or new identities. Leave the legacy /stock route and access behavior separate.
Read published ingredient snapshots from the environment's existing KV through
the normal menu loader. Never serve production ingredients from test. Validate
and allowlist output; no customer details, recipes or private raw rows returned.
Show selected Saturday, live/test source and on-device decision persistence.
Default to this coming Saturday in Singapore, including Saturday itself; do not
advance at the storefront's Thursday ordering cutoff. Allow another bake date
and refresh; missing/unpublished or mismatched snapshots must show a clear error.
No Sheet/inventory/status writes and no shared-device sync of checklist decisions.

Acceptance: authentication and environment boundaries, correct date/quantities,
missing snapshot/error/retry, swipe/review/copy persistence and mobile view tested.
Run full tests/lint/build and guarded test then production verification. Rollback
removes the admin entry/API without reversing any order or operator data.

Verification before release: 192 tests pass; lint/build pass with the existing
SwirlGame hook warning. Auth tests deny unsigned/wrong identities and prove the
stock endpoint uses only the isolated test snapshot in test. Tests cover methods,
source pairing, invalid dates, missing/mismatched snapshots and output allowlist.
Phone fixture verifies have/buy, review, shopping list copy and refresh persistence.
No real stock, order, payment or recipe values were changed for UI checks.
