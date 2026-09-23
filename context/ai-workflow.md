# AI Workflow

## Standard Unit Of Work

1. Read `AGENTS.md`, every file in `context/`, and the requested spec.
2. Inspect the relevant code, tests, and operations documentation.
3. If the spec conflicts with the baseline, stop and report the conflict.
4. Mark the item in `context/progress.md` as in progress when implementation
   begins.
5. Implement only the scope described by the spec.
6. Add or adapt focused tests.
7. Run verification appropriate to the changed surface.
8. Update progress and hand off a concise implementation summary.

## Guardrails

- Do not silently change production behavior.
- Do not refactor unrelated code while implementing a small feature.
- Do not invent an integration, account configuration, or live data schema.
- Do not claim live behavior was verified unless it was checked through the
  relevant live or test path.
- Do not introduce payment code until the architecture review and a payment
  spec have been approved.

## Spec Expectations

Each implementation spec should state a goal, scope, dependencies, design
decisions, non-goals, acceptance criteria, verification steps, and rollback
considerations. Use one spec per independently reviewable unit.
