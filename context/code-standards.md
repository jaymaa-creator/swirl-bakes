# Code Standards

## General

- Prefer existing React, Worker, and Apps Script patterns over new frameworks
  or dependencies.
- Make the smallest change that satisfies the approved spec.
- Use descriptive names and explicit data transformations.
- Preserve existing response fields and data formats unless a spec calls out a
  migration.
- Keep comments focused on non-obvious constraints or operational reasons.

## Frontend

- Keep the public experience mobile-first and accessible.
- Use the existing Tailwind utility and component conventions.
- Represent loading, error, and unavailable states deliberately; do not hide a
  failed data request behind guessed local availability.
- Keep browser requests relative to the current origin unless a spec requires
  otherwise.

## Worker And Integrations

- Validate method, origin, body size, and external payload shape at API
  boundaries.
- Return JSON errors without sensitive internal details.
- Put configuration and secrets in Worker bindings or Apps Script properties,
  never source files.
- Preserve test/production behavior differences intentionally and document any
  new one.
- For writes that may be retried, design an idempotency key before deployment.

## Tests And Verification

- Add focused Node tests under `test/` for pure logic and behavior changes.
- Run `npm test`, `npm run lint`, and `npm run build` for application changes
  when the environment permits.
- Syntax, build, and unit tests do not substitute for checking a real API or
  rendered browser flow when a change affects them.
