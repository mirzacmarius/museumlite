# Plan 043: Require auth for portal settings and integration reads

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. SKIP updating `plans/README.md` — reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f3383f6e..HEAD -- packages/backend/convex/organizations.ts packages/backend/convex/integrations.ts packages/backend/tests/`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f3383f6e`, 2026-06-29

## Why this matters

`getPortalSettings` and `integrations.getEnabled`/`isEnabled` return org configuration to any caller with an org ID — no auth or membership check.

## Current state

- `packages/backend/convex/organizations.ts:1173-1201` — `getPortalSettings` loads org by ID, no auth
- `packages/backend/convex/integrations.ts:59-89` — `getEnabled` / `isEnabled` same pattern
- Exemplar: `organizations.get` membership check at `:449-457`; `getUsageStats` at `:1589+`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Org/integration tests | `cd packages/backend && bun run test integrations.test.ts organizations.test.ts` | all pass |
| Full backend | `cd packages/backend && bun run test` | all pass |
| Typecheck / lint | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/organizations.ts` — `getPortalSettings` only
- `packages/backend/convex/integrations.ts` — `getEnabled`, `isEnabled`
- Tests in `packages/backend/tests/`

**Out of scope**: `getBySlug` (plan 044); mutation handlers in integrations.ts

## Git workflow

- Branch: `advisor/043-gate-portal-and-integration-reads`
- Commit message: `fix: require org membership for portal settings and integration reads`
- Do not push unless instructed.

## Steps

### Step 1: getPortalSettings

Add auth + org membership verification before returning data. Match error tone used in `organizations.get`.

**Verify**: unauthenticated convex-test query throws; non-member throws; member succeeds.

### Step 2: getEnabled and isEnabled

Same membership gate on `args.organizationId`. Use existing helper/index pattern from org module.

**Verify**: tests for reject unauthenticated / non-member / allow member.

### Step 3: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] All three queries require authenticated org member
- [ ] Negative + positive tests added
- [ ] typecheck, lint, backend tests pass
- [ ] Only in-scope files changed

## STOP conditions

- Callers require public anonymous access — report caller paths; do not weaken without reviewer

## Maintenance notes

Dashboard portal page (`apps/app/.../portal/page.tsx`) uses `getPortalSettings` — must remain working for logged-in members.
