# Plan 039: Fix remaining parallel counter races under Promise.all

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat acb6dfa4..HEAD -- packages/backend/convex/notifications.ts packages/backend/convex/collections.ts packages/backend/convex/collectionGroups.ts packages/backend/convex/library/holds.ts packages/backend/convex/workflowSla.ts packages/backend/convex/organizationCleanup.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (plan 034 fixed insurance auto-claim only)
- **Category**: bug
- **Planned at**: commit `acb6dfa4`, 2026-06-29

## Why this matters

Plan 034 fixed the insurance auto-claim `claimedAmount` race. The same anti-pattern (`+=`/`++` inside `Promise.all` mappers) remains in notifications bulk delete, collections bulk ops, group membership adds, hold expiry cron, SLA checks, and org cleanup — returned counts can be wrong.

## Current state

Exemplar (already fixed): `packages/backend/convex/insurance.ts` — sequential sum after plan 034.

Still racy (grep `Promise.all` + outer mutating accumulators):
- `packages/backend/convex/notifications.ts:458`, `:600`, `:662` — `count++`
- `packages/backend/convex/collections.ts:2522`, `:3079-3152` — bulk delete/deaccession counters
- `packages/backend/convex/collectionGroups.ts:485` — `addedCount++`
- `packages/backend/convex/library/holds.ts:483` — `totalExpired +=`
- `packages/backend/convex/workflowSla.ts:289` — `totalBreaches`/`totalWarnings +=`
- `packages/backend/convex/organizationCleanup.ts:740` — `storageBytes +=`

Safe pattern reference: `packages/backend/convex/media.ts:1702-1734` — returns tokens from map, aggregates after.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `cd packages/backend && bun run test notifications.test.ts collections.test.ts collectionGroups.test.ts libraryHolds.test.ts workflowSla.test.ts organizationDeletion.test.ts` | all pass |
| Full backend | `cd packages/backend && bun run test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Grep gate | `rg -n "Promise\\.all" packages/backend/convex --glob '!**/_generated/**' -A3 \| rg "\\+\\+|\\+="` | review each hit — no shared outer var mutation inside map callbacks |

## Scope

**In scope**: Files listed in Current state — refactor accumulators only.

**Out of scope**: Counter allocation races (COR-02); batch job idempotency (COR-16); schema/index changes.

## Git workflow

- Branch: `advisor/039-fix-remaining-parallel-counter-races`
- Commit message: `fix: aggregate Promise.all results without shared mutators`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Inventory

Run grep from Commands table; list each site with outer variable name.

**Verify**: written list matches Current state paths (± line drift OK if pattern unchanged).

### Step 2: Refactor each site

For each racy block: have the async callback **return** a number or `{ ok, fail, skipped }` token; after `await Promise.all`, reduce/sum/filter in TypeScript.

**Verify**: no `++`/`+=` on outer `let` inside `.map(async` passed to `Promise.all` in touched files.

### Step 3: Add or extend regression tests

At minimum one multi-item test proving count accuracy:
- notifications bulk mark-read/delete returning correct count, OR
- collections bulk delete/deaccession result tallies, OR
- collectionGroups add duplicate-safe count

**Verify**: new/updated tests pass.

### Step 4: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] All listed sites use return-then-reduce pattern
- [ ] At least one multi-item regression test
- [ ] typecheck, lint, backend tests pass
- [ ] Only in-scope files changed

## STOP conditions

- Pattern at cited line replaced by unrelated refactor — re-read and update plan with reviewer
- Fix requires schema migration — stop and report

## Maintenance notes

Consider ESLint custom rule or codemod extension in `packages/backend/scripts/fix-async-parallel.mjs` (COR-17).
