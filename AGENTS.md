# Swirl Girl Agent Guide

Swirl Girl is an existing Vite/React storefront with a Cloudflare Worker and
Google Apps Script operational backend. Preserve that architecture unless a
spec explicitly changes it.

Before any implementation:

1. Read every file in `context/`.
2. Read the requested file in `specs/`, if one is named.
3. Inspect the relevant implementation and tests before proposing a change.
4. Report a material conflict between the spec and the current code before
   changing behavior.
5. Update `context/progress.md` only when the work state actually changes.

While implementing:

- Keep the requested unit small and avoid unrelated refactors.
- Preserve production/test separation and existing public API shapes unless the
  spec says otherwise.
- Treat Google Sheets as an operator-managed source, not a customer-facing
  runtime dependency.
- Validate external input at Worker and Apps Script boundaries.
- Keep secrets out of browser code, committed files, logs, and UI text.
- Add or update focused tests for behavior changes.

Before handoff:

1. Run the relevant tests, lint, and build where feasible.
2. Check every spec acceptance criterion.
3. Summarize changed files, verification, and unresolved risks.

Do not build payment functionality until an approved payment spec exists.
