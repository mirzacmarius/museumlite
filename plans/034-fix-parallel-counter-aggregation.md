# Plan 034: Fix parallel counter aggregation in insurance auto-claim

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- packages/backend/convex/insurance.ts packages/backend/tests/insurance.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

`createAutoClaimForTransitDamage` sums `claimedAmount` inside a `Promise.all` map with `claimedAmount +=`. Concurrent async callbacks race on the shared variable, so totals can be wrong when multiple collections have active coverages.

## Current state

```text
packages/backend/convex/insurance.ts:1869-1881 — let claimedAmount = 0; await Promise.all(... map ... claimedAmount += coverage.coveredValue)
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Insurance tests | `cd packages/backend && bun test insurance.test.ts` | all pass |
| Full backend tests | `cd packages/backend && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/insurance.ts` (`createAutoClaimForTransitDamage` claimedAmount loop only)
- `packages/backend/tests/insurance.test.ts` (add test if file exists; otherwise minimal new test in existing insurance test module)

**Out of scope**:
- Plan 035 (createdBy user attribution in same function)
- Other `Promise.all` + `+=` patterns elsewhere (separate plans)

## Git workflow

- Branch: `advisor/034-fix-parallel-counter-aggregation`
- Commit message: `fix(insurance): compute auto-claim amount without race`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Replace racy aggregation

Replace the `Promise.all` + `+=` block with one of:

- **Preferred**: sequential `for ... of args.collectionIds` loop fetching coverage and summing; or
- **Alternative**: `Promise.all` returning per-collection amounts, then `reduce((sum, n) => sum + n, 0)`.

Do not mutate a shared outer variable inside concurrent callbacks.

**Verify**: `rg -n "claimedAmount \+=" packages/backend/convex/insurance.ts` inside `createAutoClaimForTransitDamage` shows only safe sequential/reduce usage.

### Step 2: Add regression test

Add a convex-test that seeds two collections with active coverages (values e.g. 1000 and 2500), calls `internal.insurance.createAutoClaimForTransitDamage`, and asserts `claimedAmount === 3500`.

**Verify**: targeted insurance tests pass.

### Step 3: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] No shared-variable mutation inside concurrent `Promise.all` callbacks for claimedAmount
- [ ] Test proves sum of multiple coverages is correct
- [ ] typecheck, lint, backend tests pass
- [ ] Only in-scope files changed

## STOP conditions

- Function renamed or removed
- Cannot seed two active coverages in test harness — report with attempted fixture

## Maintenance notes

Search repo for similar `Promise.all` + outer `+=` patterns when touching insurance module.
