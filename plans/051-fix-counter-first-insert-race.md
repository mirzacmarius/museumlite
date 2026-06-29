# Plan 051: Fix counter first-insert race (duplicate numbers)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 93c6f7e3..HEAD -- packages/backend/convex/utils/accessionCounter.ts packages/backend/convex/utils/numberGenerator.ts packages/backend/convex/utils/organizationUsageCounters.ts packages/backend/convex/schema.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `93c6f7e3`, 2026-06-29

## Why this matters

Number generators use a check-then-insert pattern: if no counter row exists, two concurrent mutations can both insert a new row and both return `1`. That produces duplicate accession, loan, account, transit, and deaccession numbers within an org. Plan 039 fixed lost increments on existing rows; this fixes the **first-use** race on empty counters.

## Current state

- `packages/backend/convex/utils/accessionCounter.ts:25-56` — `getNextCounterValue` queries by index, then `patch` or `insert` without retry when insert races.
- `packages/backend/convex/utils/numberGenerator.ts:119-139` — same insert-if-missing for year-scoped counters (`loanCounters`, `transitCounters`, etc.).
- `packages/backend/convex/utils/organizationUsageCounters.ts:92-111` — `ensureUsageCounter` has the same pattern (duplicate usage counter rows possible).
- Schema indexes are **not unique**: `accessionCounters` at `schema.ts:584-588`, year counters at `schema.ts:262-276`, `organizationUsageCounters` at `schema.ts:1769-1774`.
- Existing increment-on-row path is safe once a row exists (OCC on patch).

**Convention to follow**: plain TypeScript helpers in `utils/` called from mutation handlers; add tests under `packages/backend/tests/` using `convexTest` + `modules` from `./testSetup` (see `accounts.test.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Counter tests | `cd packages/backend && bun run test accessionCounter numberGenerator` | all pass |
| Full backend | `cd packages/backend && bun run test:once` | exit 0 |
| Typecheck | `cd /Users/marius/Developer/ml && bun run typecheck` | exit 0 |
| Lint | `cd /Users/marius/Developer/ml && bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/utils/accessionCounter.ts`
- `packages/backend/convex/utils/numberGenerator.ts`
- `packages/backend/convex/utils/organizationUsageCounters.ts` — `ensureUsageCounter` only
- New test file(s): `packages/backend/tests/accessionCounter.test.ts` (and extend existing number-generator tests if present)

**Out of scope**:
- Schema migration to dedupe existing duplicate counter rows (document in PR notes if found; do not auto-delete production data).
- Parallel `+=` races (plan 039 — already done).
- Changing number formats or prefix strings.

## Git workflow

- Branch: `advisor/051-fix-counter-first-insert-race`
- Commit message style: `fix(counters): retry first-insert race on counter allocation` (match repo conventional commits)
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add shared retry helper

Create a small helper (in `accessionCounter.ts` or a new `utils/counterAllocation.ts`) that implements:

```typescript
async function allocateCounterValue(
  ctx: MutationCtx,
  loadExisting: () => Promise<Doc | null>,
  insertNew: () => Promise<Id>,
  incrementExisting: (row: Doc) => Promise<number>,
  maxAttempts = 5,
): Promise<number>
```

Logic:
1. Load existing row.
2. If found → patch increment, return value.
3. If not found → try insert; **immediately re-query** by index.
4. If re-query finds a row (another mutation won the race) → increment that row instead of using your insert's return value.
5. If re-query finds **multiple** rows → pick the oldest by `_creationTime`, increment it, log a warning in test-only path (do not delete in this plan).
6. Retry loop if still ambiguous after `maxAttempts` → throw `"Counter allocation conflict"`.

**Verify**: `bun run typecheck` exit 0.

### Step 2: Refactor `getNextCounterValue`

Replace the if/else insert block in `accessionCounter.ts:36-56` with the retry helper. Keep the public function signature unchanged.

**Verify**: `rg -n "await ctx.db.insert\\(\"accessionCounters\"" packages/backend/convex/utils/accessionCounter.ts` — only inside the helper's insert path, not duplicated in `getNextCounterValue` body.

### Step 3: Refactor `numberGenerator.ts` increment helper

Apply the same pattern to the shared increment function around lines 119-139 (both year-scoped and global counter tables that use insert-if-missing).

**Verify**: grep shows no bare insert-without-requery in number generator counter paths.

### Step 4: Harden `ensureUsageCounter`

In `organizationUsageCounters.ts:92-111`, after insert, re-query `.unique()`; if another row exists, return the existing one and do not leave callers with a stale duplicate reference.

**Verify**: typecheck passes.

### Step 5: Add concurrency regression tests

In `packages/backend/tests/accessionCounter.test.ts`:

1. **Happy path** — sequential calls return 1, 2, 3 for same org/scope.
2. **Simulated race** — in one `t.run` mutation, insert a counter row between two logical allocate calls; second call must not return 1 again.
3. **Optional** — two parallel `t.run` blocks that both call a thin test-only internal mutation wrapping `getNextCounterValue` (if you add a test export); assert distinct values or single counter row.

Model test setup after `accounts.test.ts` org + user inserts.

**Verify**: `cd packages/backend && bun run test accessionCounter.test.ts` — all pass.

### Step 6: Full gates

Run backend test suite, root lint, root typecheck.

**Verify**: all green.

## Test plan

- New file `packages/backend/tests/accessionCounter.test.ts` with at least 2 tests (sequential + race simulation).
- If number generator has no test file, add minimal test for one counter table (e.g. loan number) asserting monotonic values across 3 calls.

## Done criteria

- [ ] Counter allocation uses re-query-after-insert (or equivalent) in accession, numberGenerator, and ensureUsageCounter paths
- [ ] New tests pass; backend suite passes
- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] No files outside scope modified
- [ ] `plans/README.md` status row updated to DONE (or left TODO if reviewer maintains index)

## STOP conditions

- Live code at cited line ranges differs materially from excerpts (drift).
- Fixing requires schema unique indexes (Convex limitation) — report back; do not invent DB constraints that don't exist.
- Duplicate counter rows already exist in dev data and `.unique()` throws — report counts; do not delete rows without a migration plan.

## Maintenance notes

- Future counter tables must use the shared helper, not copy-paste insert-if-missing.
- PR reviewer should check all call sites of `getNextCounterValue` and `incrementCounter` still return monotonic values.
- Dedupe migration for existing duplicate rows is explicitly deferred.
