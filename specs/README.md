# Implementation Specs

This directory is intentionally empty of payment implementation specs until the
architecture baseline in `context/` has been reviewed.

Each future spec should be a small, independently reviewable unit named with a
stable identifier, for example `PAY-001-current-order-lifecycle.md`.

Required sections:

- Goal
- Scope and non-goals
- Existing dependencies
- Design decisions
- Data/API changes
- Acceptance criteria
- Verification plan
- Rollback or failure handling

An agent may implement only an explicitly requested spec. A payment spec must
preserve the documented architecture invariants unless it explicitly proposes
and receives approval for a change.
