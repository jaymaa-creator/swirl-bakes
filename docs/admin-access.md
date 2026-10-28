# Admin sign-in setup

The dashboard is `/admin`; its only API is `GET /api/admin/session`.
The code denies access until Cloudflare Access is configured.

1. In Cloudflare Zero Trust, configure the Google identity provider using a Google
   OAuth web client. Follow https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/ .
   Keep OAuth credentials in Cloudflare, never in this repository.
2. Create a self-hosted Access application for the test hostname with paths
   `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`. Select only Google as the
   login method (disable acceptance of all providers). Allow only the two exact
   user-approved email addresses. Do not allow an entire email domain.
3. Set Worker variables `ADMIN_ACCESS_ISSUER` to the exact HTTPS team domain
   (no trailing slash) and `ADMIN_ACCESS_AUD` to that application's audience tag.
   Set `ADMIN_EMAILS` to the two comma-separated email addresses, preferably with
   `wrangler secret put ADMIN_EMAILS --config wrangler.test.jsonc`.
   Keep environment-specific values outside source control and preserve them on
   deploy (Wrangler `--keep-vars` for remotely managed text variables).
4. Deploy only the test Worker using the guarded test deploy workflow. Verify
   unconfigured/unauthenticated direct requests cannot retrieve admin HTML or API
   data. Protect every public hostname exposing admin paths, or leave unprotected
   aliases denied by the Worker's token check.
5. Each owner signs in with Google. Verify identity, refresh, logout, third-account
   denial, mobile layout and that the public storefront remains accessible.

Token checks follow Cloudflare's origin-validation guidance:
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

Local Vite serves the UI only and does not provide authentication. Use Worker
preview to test the security boundary. Do not add a development login bypass to
production code. The automated tests generate temporary signing keys and exercise
real signature verification; they do not prove the Cloudflare/Google setup works.

## Production release verified 2026-10-28

https://swirlgirl.sg/admin uses Access application
`cea3f4ae-20d4-4508-9038-da5dbd8092d5`, Google only and the existing two-admin
policy. Its audience is distinct from test; issuer, audience and exact allowed
emails are Worker secrets. Owner session and production menu verified in Chrome.
Sales & customers was subsequently enabled by approved release 40658940100;
see docs/admin-sales-reporting.md. Unsigned canonical requests redirect
to Access; unsigned www/Worker-alias session requests return 401. Partner login
and actual production photo publication remain unverified. See context/progress.md
for versions and release verification. The initial GitHub R2 permission failure
was resolved on 2026-10-28 with bucket-scoped read-only permission; release
40623848089 attempt 2 completed successfully.
