# Production releases

The release workflow treats a deployment like a sealed box: CI inspects the
code, the release job builds and checksums one artifact, a person approves that
exact commit for production, and Cloudflare receives the same artifact.

## One-time GitHub setup

Create `test` and `production` environments in the repository settings. Add
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as environment secrets in
both. Configure at least one required reviewer on `production`; do not add a
reviewer requirement to `test` unless test releases should also pause.

Protect `main` and require the `CI / verify` check before merging. Limit direct
pushes to `main` if the repository plan supports it.

## Release

1. Merge a clean, reviewed commit and copy its full 40-character SHA.
2. Run **Release exact commit** from GitHub Actions. Choose `test` to stop after
   test, or `production` to promote after test succeeds.
3. The workflow reruns tests, lint and build, deploys the sealed artifact to
   test, then checks the homepage, live menu and order-validation boundary
   without creating an order.
4. For `production`, enter `DEPLOY swirl-girl`. After the test deployment and
   smoke checks pass, GitHub pauses for production approval and then deploys
   the exact same checksummed artifact.
5. Download the deployment-evidence artifact from the run. It records the
   previous and resulting Worker deployments for audit and rollback.

If the chosen commit changes `apps-script/`, a test-only release stops because
the Apps Script service and Sheet are shared with production. Every production
release requires the currently deployed numeric Apps Script version; deploy a
new web-app version first when that code changed. This is an operator
attestation because Google does not expose the current web-app version to this
GitHub workflow.

## Rollback

Run **Roll back Worker**, choose the environment, paste the exact prior Worker
version UUID from the release evidence, and enter the displayed confirmation
phrase. Production rollback uses the same production reviewer gate and runs the
same smoke checks afterward. A Worker rollback does not undo Google Apps Script
or Sheets changes; coordinate those separately when they changed in the release.

## Local deployment guard

`npm run deploy` now refuses production unless the repository is on `main`, the
working tree is clean, `wrangler.jsonc` names `swirl-girl`, and the explicit
confirmation environment variable is present:

```sh
DEPLOY_PRODUCTION_CONFIRM='DEPLOY swirl-girl' npm run deploy
```

Prefer the GitHub release workflow because it adds review, artifact identity,
release evidence, smoke checks, and a repeatable rollback path.
