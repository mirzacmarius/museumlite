# Plan 055: Validate all batch job collection IDs belong to org

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 93c6f7e3..HEAD -- packages/backend/convex/batchOperations.ts packages/backend/tests/batchOperations.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `93c6f7e3`, 2026-06-29

## Why this matters

`createBulkEditJob` validates org ownership for only the **first 10** collection IDs (`batchOperations.ts:60-61`). A user with `collections.update` in org A can enqueue a 1000-item job where IDs 11–1000 belong to org B; the worker may partially mutate foreign objects before per-item errors. This is a tenant-integrity gap adjacent to plans 015–016.

## Current state

- `packages/backend/convex/batchOperations.ts:59-67`:

```typescript
const collections = await Promise.all(
  args.collectionIds.slice(0, 10).map((id) => ctx.db.get(id)),
);
for (const collection of collections) {
  if (collection && collection.organizationId !== args.organizationId) {
    throw new Error("Some collections do not belong to this organization");
  }
}
```

- Similar job creators: `createBulkMoveJob`, `createBulkStatusChangeJob`, `bulkAddTags`, `quickBulkEdit` — grep `collectionIds` validation in same file; extend fix to all public mutations accepting `collectionIds` arrays.
- Tests: `packages/backend/tests/batchOperations.test.ts` — DB-only, no `api.batchOperations.*` calls (optional add-on in this plan).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Batch tests | `cd packages/backend && bun run test batchOperations.test.ts` | all pass |
| Backend suite | `cd packages/backend && bun run test:once` | exit 0 |
| Typecheck | `cd /Users/marius/Developer/ml && bun run typecheck` | exit 0 |
| Lint | `cd /Users/marius/Developer/ml && bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/batchOperations.ts` — validation helper + all job-creation mutations
- `packages/backend/tests/batchOperations.test.ts` — add API-level rejection test

**Out of scope**:
- Batch job idempotency / processing races (COR-16).
- Rewriting entire batch test file to call processor (TEST-02).

## Git workflow

- Branch: `advisor/055-validate-batch-job-collection-ids`
- Commit message: `fix(batch): validate all collection IDs belong to org`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Extract validation helper

Add to `batchOperations.ts` (or `utils/batchValidation.ts` if file is already large):

```typescript
async function assertCollectionsBelongToOrg(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  collectionIds: Id<"collections">[],
): Promise<void>
```

Implementation:
- Reject empty array (existing behavior elsewhere).
- For each ID: `ctx.db.get("collections", id)` — if missing, throw `"Collection not found: <id>"`.
- If `collection.organizationId !== organizationId`, throw `"Some collections do not belong to this organization"`.
- Use sequential loop or batched `Promise.all` (max 1000 IDs — acceptable).

**Verify**: typecheck passes.

### Step 2: Replace slice(0, 10) validation

In `createBulkEditJob` and every sibling mutation that accepts `collectionIds`, call the helper on the **full** array before inserting `batchJobs`.

**Verify**: `rg "slice\\(0, 10\\)" packages/backend/convex/batchOperations.ts` — no matches.

### Step 3: Add regression test

In `batchOperations.test.ts`:

1. Setup org A and org B with collections in each; user with `collections.update` on org A only (`withIdentity` + permissions like `accounts.test.ts`).
2. Call `api.batchOperations.createBulkEditJob` with `[orgA_collectionId, orgB_collectionId]`.
3. Expect rejection before job row created (query `batchJobs` count unchanged).

**Verify**: new test passes.

### Step 4: Full gates

Backend tests, lint, typecheck.

## Test plan

- One new test: mixed-org ID list rejected at job creation.
- Existing batchOperations tests still pass.

## Done criteria

- [ ] All `collectionIds` validated (no `slice(0, 10)`)
- [ ] New rejection test passes
- [ ] `bun run test:once` passes
- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] Only in-scope files modified

## STOP conditions

- Job types use non-collection target IDs (locations, etc.) — extend helper separately; do not over-generalize in one function without reading each mutation.
- Validation causes timeout on 1000 IDs in tests — batch gets in chunks of 100 if needed.

## Maintenance notes

- Any new bulk mutation accepting ID arrays must call `assertCollectionsBelongToOrg`.
- Full batch processor tests remain deferred (TEST-02).
