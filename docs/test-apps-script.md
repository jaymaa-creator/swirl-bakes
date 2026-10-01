# Isolated test Apps Script

Test Sheet: `1N18vGGPWD9u47Wr2YeWfEydA4oK9Ab-ooEfIvycUbGc`

Test script: `1JCK71mOfjevGafjHEj14Kr0Oj_O5e0zYi4H0eIwARt3FPB0R0Uvkftj9`

`npm run apps:build:test` generates `apps-script-test/` from the shared source.
The generated output is ignored by Git; the generator, target configuration
and isolation tests are version controlled. Do not hand-edit generated files.
`npm run apps:push:test` updates only the copied test editor project. It does
not deploy a web app. The existing `.clasp.json` remains the production target.

All custom named functions use `TEST_`. Google's `doGet`/`doPost` entry points
delegate to prefixed functions. All existing helpers check the project ID.
Spreadsheet access is restricted to the test Sheet; HTTP requests are restricted
to the exact test menu-sync endpoint and cannot follow redirects. Publishing
uses test availability only. Monitoring email is disabled. Order writes require
the test secret plus `environment: "test"`. The secret property is
`TEST_ORDER_WEBHOOK_SECRET`, never the inherited production secret property.

## Connected test backend

Apps Script deployment (initial version 1; later test revisions were deployed):
`AKfycbzD0EMRRgCqPPRMyVMeZ6RS_5q8iw8TBKe5njr8HDDK4f7Qq1DhdztW9VdVqUQ_Xng8`.

The dedicated `src/testWorker.js` entry checks the exact test hostname and
authenticates the backend identity before order writes. It maps only the test
secret and endpoint into shared order handling. It stores menu snapshots under
`isolated-test:` keys and does not use the old Sheets/edge-cache fallback.
The old `/api/menu/sync` path acknowledges and ignores production publication;
only `/api/test/menu/sync` with the new test secret can update this menu.
Production's publishing implementation is unchanged.

The initial snapshot was seeded using `node scripts/seed-test-menu.mjs`.
After-order background publication was live-verified: a single dummy order
increased test cinnamon stock sold from 2 to 3, remaining 4 to 3.
Request `9274ab7c-7d03-4948-a2fb-d973345badc1` returned
`TEST-ef93c53e-3091-422b-8f0a-1ac2dbd258f4`; replay returned the same reference
and `duplicate: true`. It remains in the test Sheet labelled do not fulfil.
No real message or payment was sent. Test receipt WhatsApp buttons simulate
the handoff. Copied records have not been edited or removed.

## Operator follow-up

1. In the copied project only, run `TEST_checkIsolation` and authorize Google
   access. Confirm its returned spreadsheet ID matches the test Sheet above.
2. User approved retaining copied customer records. Do not clear them. Keep
   workbook access restricted. New references use `TEST-` plus a UUID so they
   cannot collide with copied production order references. Referral processing
   must explicitly exclude copied historical orders; that feature is not built.
3. Run `TEST_inspectSetup` to report trigger names and configuration presence
   without printing secret values or customer records. Do not run old setup functions.
4. Independent test secret has been configured in Apps Script and the test Worker.
   Never copy this value into chat or Git. Keep the copied Sheet restricted.
5. Test web app and order routing are deployed; the dummy order and replay pass.
6. Run `TEST_installMenuSyncTrigger` once in the copied project to enable menu
   updates after manual Sheet edits, then `TEST_syncMenuSnapshot`. This installed
   edit trigger has not yet been confirmed. Do not enable monitoring emails.

Building or pushing this script does not change the production Apps Script,
Sheet, Worker bindings or deployment. The isolated test backend now supports
the referral MVP; controlled live test orders have exercised code generation,
friend discount, paid credit creation and FIFO redemption. For current release
status and remaining production blockers, see
`docs/referral-production-readiness.md`.
