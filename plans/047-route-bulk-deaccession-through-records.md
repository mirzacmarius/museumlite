# Plan 047: Route bulkDeaccession through deaccession records

> **Executor instructions**: Follow step by step. Run every verification command. STOP conditions — stop and report. SKIP updating `plans/README.md`.
>
> **Drift check**: `git diff --stat 37e12dee..HEAD -- packages/backend/convex/collections.ts packages/backend/convex/deaccessions.ts packages/backend/tests/collections-bulk.test.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 045 (tests exist)
- **Category**: bug
- **Planned at**: commit `37e12dee`, 2026-06-29

## Why this matters

`bulkDeaccession` marks collections deaccessioned without creating `deaccessions` rows, breaking compliance/reporting. It also races permission check with `markCollectionDeaccessioned` in `Promise.all`.

## Current state

- `packages/backend/convex/collections.ts:3098-3172` — calls `markCollectionDeaccessioned` directly
- `packages/backend/convex/deaccessions.ts:196-337` — `createDeaccessionRecord` creates proper records + workflow
- Tests: `packages/backend/tests/collections-bulk.test.ts`

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Bulk tests | `cd packages/backend && bun run test collections-bulk.test.ts` | pass |
| Full backend | `cd packages/backend && bun run test` | pass |
| Gates | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**: `collections.ts` (`bulkDeaccession`), export/share `createDeaccessionRecord` (move to `utils/deaccessionRecords.ts` OR export from `deaccessions.ts`), `collections-bulk.test.ts`

**Out of scope**: UI method picker; changing single-item deaccession API

## Git workflow

- Branch: `advisor/047-route-bulk-deaccession-through-records`
- Commit: `fix(collections): create deaccession records in bulkDeaccession`

## Steps

### Step 1: Share createDeaccessionRecord

Export `createDeaccessionRecord` for use from `collections.ts` without circular imports (extract to `packages/backend/convex/utils/deaccessionRecords.ts` if needed; update `deaccessions.ts` to import from util).

### Step 2: Rewrite bulkDeaccession handler

For each collectionId (sequential or return-then-reduce, not racy Promise.all on permission+mark):
1. Skip if missing or already deaccessioned
2. Fail/skip if loaned (match current behavior)
3. `requirePermission` then call `createDeaccessionRecord` with:
   - `reason: args.reason`
   - `method: "destruction"` (default for bulk — document in code comment)
   - `dateDeaccessioned: Date.now()`
4. Count success when record created (pending workflow counts as deaccessioned success for bulk tallies — document in test)

Remove direct `markCollectionDeaccessioned` + manual audit insert (createDeaccessionRecord handles audit).

### Step 3: Update tests

Assert `deaccessions` row exists for successfully bulk-deaccessioned collections. Update count expectations if workflow creates pending records without immediate `collection.status === "deaccessioned"` — use org with workflow disabled in happy path test.

### Step 4: Full gates

## Done criteria

- [ ] bulkDeaccession creates deaccession records
- [ ] No permission/mark race in Promise.all
- [ ] Tests assert deaccession rows
- [ ] typecheck, lint, full backend tests pass

## STOP conditions

- Circular import cannot be resolved without large refactor — report

## Maintenance notes

Future: add `method` arg to bulk mutation when UI supports it.
