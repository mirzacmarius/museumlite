# Plan 045: Test collections bulkDeaccession mutation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. SKIP updating `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3383f6e..HEAD -- packages/backend/convex/collections.ts packages/backend/tests/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f3383f6e`, 2026-06-29

## Why this matters

`bulkDeaccession` handles multi-object catalog changes with permission checks and skip/fail counts but has zero API-level tests.

## Current state

- `packages/backend/convex/collections.ts:3098-3172` — `bulkDeaccession` mutation
- No `bulkDeaccession` in `packages/backend/tests/*.test.ts`
- Pattern: `packages/backend/tests/deaccessions.test.ts`, permission harness in other collection tests

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| New tests | `cd packages/backend && bun run test collections.test.ts deaccessions.test.ts` | all pass |
| Full backend | `cd packages/backend && bun run test` | all pass |
| Typecheck / lint | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**: New or extended tests in `packages/backend/tests/` only (may add `collections-bulk.test.ts`)

**Out of scope**: Changing bulkDeaccession behavior (COR-08 workflow records — separate plan)

## Git workflow

- Branch: `advisor/045-test-bulk-deaccession`
- Commit message: `test(collections): cover bulkDeaccession mutation`
- Do not push unless instructed.

## Steps

### Step 1: Fixture

Use convex-test with org, user with `collections.delete`, seed 2+ active collections + one already deaccessioned + one on-loan if fixture supports.

### Step 2: Tests via api.collections.bulkDeaccession

1. Happy path: mixed IDs → correct `{ deaccessioned, skipped, failed }` counts; deaccessioned rows have status `deaccessioned`
2. Unauthenticated → error
3. User without permission → failed count or error per current behavior

**Verify**: tests call public API not direct db insert.

### Step 3: Full gates

Run full backend tests, typecheck, lint.

## Done criteria

- [ ] At least 3 meaningful test cases via `api.collections.bulkDeaccession`
- [ ] Full backend suite passes
- [ ] Only test files changed (unless STOP)

## STOP conditions

- Cannot seed loaned object in test harness — document and test what you can

## Maintenance notes

When COR-08 adds deaccession records, extend tests to assert record creation.
