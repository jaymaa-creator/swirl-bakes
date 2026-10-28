# ADMIN-001: Blank admin dashboard

## Goal and approved scope

Create a new `/admin` workspace, independent of `/stock`, with Google sign-in
for the two accounts supplied by the user. Initial dashboard contains a welcome,
verified account email, sign-out, and a storefront link. No operational controls.

## Design and dependencies

Cloudflare Access performs Google login. One Access application per environment
covers `/admin`, `/admin/*`, `/api/admin` and `/api/admin/*`. Its only allowed
login method is Google; its allow policy contains the two exact approved emails.
Worker validates Access JWT signature, issuer, audience, expiry and email against
server configuration. Missing configuration denies access. Both Wrangler configs
run admin paths through the Worker before serving assets. Test admin routing does
not require the unrelated Apps Script backend to be configured.

Configuration: ADMIN_ACCESS_ISSUER, ADMIN_ACCESS_AUD, ADMIN_EMAILS (comma-separated,
exactly two distinct addresses). Store account addresses in Worker configuration,
not frontend or committed files. Test and production use distinct audiences.

## Non-goals

Stock/orders/product tools, changes to existing stock access, payments, customer
accounts, Google Sheets changes, and production deployment.

## Acceptance and verification

- Both approved identities receive the blank dashboard and session endpoint.
- Other identities, missing/forged/expired tokens and wrong issuer/audience fail.
- Admin page and API prefixes are protected, including on direct Worker hosts.
- Unconfigured environments deny access; public routes retain existing behavior.
- Admin responses are not cached or indexed; logout uses Cloudflare Access logout.
- Run authentication tests, full tests, lint, build and diff checks.
- Live test: Google login with each approved account, rejection of a third account,
  logout, expired session, desktop/mobile layout and public ordering smoke check.

## Rollout and rollback

Configure Google provider and test Access application before deploying to test.
Set server variables and verify the actual Access redirect and Google-only policy.
Live identity verification requires each account holder to sign in themselves.
Production deployment requires a separate release step after test verification.
Rollback Worker to prior version; retain Access protection until the admin routes
are no longer served. No database or Sheet migration is needed.

## Production alignment approved 2026-10-28

The user authorized production deployment of admin login and product-photo tools.
Use a distinct production Access application with the existing two-admin policy
and Google-only authentication. Preserve the test application and deny unsigned
requests on all aliases. Sales reporting remains test-only.
