# Plan 050: Enforce allowed transit status transitions

> **Executor instructions**: Follow step by step. SKIP updating `plans/README.md`.
>
> **Drift check**: `git diff --stat 37e12dee..HEAD -- packages/backend/convex/transit.ts packages/backend/tests/transit.test.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `37e12dee`, 2026-06-29

## Why this matters

`updateTransitStatus` accepts any status value with no transition guard — records can jump invalid states.

## Current state

- `packages/backend/convex/transit.ts:302-361` — patches status without checking current state
- Statuses: draft, scheduled, in_transit, out_for_delivery, delivered, delayed, held, returned, cancelled
- Tests at `transit.test.ts:125-150` use draft → in_transit

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Transit tests | `cd packages/backend && bun run test transit.test.ts` | pass |
| Full backend | `cd packages/backend && bun run test` | pass |
| Gates | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**: `packages/backend/convex/transit.ts` — add transition helper + guard in `updateTransitStatus`; `transit.test.ts`

**Out of scope**: Other transit mutations; admin override UI

## Git workflow

- Branch: `advisor/050-enforce-transit-status-transitions`
- Commit: `fix(transit): reject invalid status transitions`

## Steps

### Step 1: Define transition map

Add `const ALLOWED_TRANSIT_TRANSITIONS: Record<Status, readonly Status[]>` in transit.ts (or utils/transitLifecycle.ts). Minimum sensible graph:

- draft → scheduled, cancelled
- scheduled → in_transit, cancelled, delayed
- in_transit → out_for_delivery, delivered, delayed, held, cancelled
- out_for_delivery → delivered, delayed, held
- delivered → returned (if returns supported)
- delayed/held → in_transit, cancelled
- terminal: cancelled, returned (no outbound except document in error message)

Allow same-status updates? Reject or no-op — pick reject for clarity.

### Step 2: Guard updateTransitStatus

Before insert/patch, if transition not allowed throw `Invalid transit status transition from X to Y`.

### Step 3: Tests

- draft → in_transit throws (or only via scheduled — match your map)
- draft → scheduled → in_transit succeeds (extend existing test)
- cancelled → in_transit throws

Align tests with map you implement.

### Step 4: Full gates

## Done criteria

- [ ] Transition matrix enforced
- [ ] Tests cover illegal + legal paths
- [ ] Existing transit tests updated if needed
- [ ] CI gates pass

## STOP conditions

- Existing production data has invalid states blocking updates — report; allow same-status no-op only

## Maintenance notes

Document matrix in comment above constant for future status additions.
