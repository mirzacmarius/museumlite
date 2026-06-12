# Plan 006: Push audit-log filtering into indexed/paginated queries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/convex/auditLog.ts packages/backend/convex/dashboard.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

`auditLog` is an append-only table that grows without bound per organization. Several read paths `.collect()` the **entire** org audit log into memory and then filter/paginate in TypeScript. As tenants accumulate history, these queries get linearly slower and will eventually hit Convex's read limits and time out — turning the audit/compliance pages into a reliability cliff. The fix is to push date/user/action filtering into the existing timestamp index and paginate at the database layer.

## Current state

### 6a. `auditLog.list` collects the whole table

`packages/backend/convex/auditLog.ts:52-99`:

```typescript
const query = ctx.db
  .query("auditLog")
  .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
  .order("desc");
let entries = await query.collect();          // loads ALL rows
if (args.userId) entries = entries.filter(...);
if (args.entityType) entries = entries.filter(...);
if (args.action) entries = entries.filter(...);
if (args.fromDate) entries = entries.filter((e) => e.timestamp >= args.fromDate!);
if (args.toDate) entries = entries.filter((e) => e.timestamp <= args.toDate!);
const totalCount = entries.length;
// manual cursor slice
```

The schema already has the needed index — `schema.ts:2358` `by_organization_and_timestamp: ["organizationId", "timestamp"]`. Two more dropdown helpers in the same file (`auditLog.ts:~154` and `~184`) also `.collect()` the full table.

### 6b. Compliance dashboard collects audit log + accessions

`packages/backend/convex/dashboard.ts:224-229` (`getComplianceReport`) `.collect()`s all org accessions; `:353-358` `.collect()`s the full org `auditLog` then JS-filters by date at `:360-362`; `:368-379` issues up to 20 sequential `ctx.db.get` calls for event users.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend lint | `cd packages/backend && bun run lint` | exit 0 |
| Backend tests | `cd packages/backend && bun run test:once` | all pass |
| Run audit/dashboard tests | `cd packages/backend && bunx vitest run audit dashboard` | pass |

## Scope

**In scope**:
- `packages/backend/convex/auditLog.ts` (`list` and the two dropdown helpers)
- `packages/backend/convex/dashboard.ts` (`getComplianceReport` audit + accession reads)
- `packages/backend/convex/auditLog.test.ts` / `dashboard.test.ts` (whichever exist)

**Out of scope**:
- `packages/backend/convex/schema.ts` — the `by_organization_and_timestamp` index already exists; do not add indexes unless a filter genuinely needs one (e.g. `by_organization_and_user`), in which case the schema edit must be additive and is the only schema change allowed.
- The audit-writing path (`internal.audit.logAction`).
- Changing the public return shape of `list` (the UI depends on `{ entries, nextCursor, totalCount }`) — preserve it.

## Git workflow

- Branch: `advisor/006-auditlog-pagination`
- Conventional commits, e.g. `perf(auditlog): paginate list via timestamp index`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Convert `auditLog.list` to a bounded, indexed query

- When `fromDate`/`toDate` are provided, use `by_organization_and_timestamp` with a range (`.withIndex("by_organization_and_timestamp", q => q.eq("organizationId", id).gte("timestamp", fromDate).lte("timestamp", toDate))`).
- Prefer Convex native pagination (`paginationOptsValidator` + `.paginate()`) over `.collect()` + manual slice. **However**, the current API returns `totalCount` and a custom `nextCursor` string. If switching to `.paginate()` changes the return shape, you must either (a) keep the custom shape but cap the scan (e.g. `.take(limit + 1)` against the ordered index after pushing date filters into the index), or (b) update callers. Pick the **minimal** change that removes the unbounded `.collect()` while preserving the documented return shape. `userId`/`entityType`/`action` filters that lack an index can remain as in-memory filters **only over the bounded page**, not the whole table.
- If a filter combination cannot be served without a full scan (e.g. action substring match with no date range), cap the scan with `.take(N)` (e.g. N=1000) and document that the filter is best-effort over recent entries, OR add a STOP note — do not silently keep the unbounded collect.

**Verify**: `rg -n "\.collect\(\)" packages/backend/convex/auditLog.ts` → only acceptable bounded uses remain (review each); `cd packages/backend && bunx vitest run audit` → pass.

### Step 2: Fix the two dropdown helpers

For the distinct-value dropdowns (`auditLog.ts:~154`, `~184`): cap with `.take(N)` over the timestamp index (recent N entries) rather than collecting all rows, or back them with a precomputed list if one exists. Document the bound.

**Verify**: `cd packages/backend && bun run lint` → exit 0.

### Step 3: Bound the compliance report reads

In `dashboard.ts:getComplianceReport`:
- Replace the full `auditLog` `.collect()` (`:353-358`) with a range query on `by_organization_and_timestamp` bounded to the report's `rangeStart`/`rangeEnd`.
- Dedupe the user IDs before the enrichment loop (`:368-379`) so you fetch each user once (`new Set`), then batch with `Promise.all`.
- The accessions `.collect()` (`:224-229`): if it only needs counts by status, and an indexed/aggregate path exists, prefer it; otherwise, if accessions are bounded per org in practice, leave it but add a `// TODO: bound if accession volume grows` comment. Do not over-engineer — the audit-log collect is the urgent one.

**Verify**: `cd packages/backend && bunx vitest run dashboard` → pass.

## Test plan

- Add/extend an `auditLog.list` test: seed > limit entries across two date ranges and assert (a) date-range filtering returns the right subset, (b) pagination cursor advances correctly, (c) `totalCount`/return shape unchanged.
- Add a `getComplianceReport` test asserting the date-bounded audit counts match expectations when entries exist outside the range.
- Verification: `cd packages/backend && bun run test:once` → all pass including new/updated tests. Compare counts against the pre-change behavior for the same fixtures (the numbers must not change for in-range data — this is a perf refactor, not a semantics change).

## Done criteria

- [ ] No unbounded `.collect()` of the full `auditLog` table remains in `auditLog.ts` or `dashboard.ts` (every remaining collect is date-bounded or `.take()`-capped)
- [ ] `auditLog.list` public return shape (`entries`, `nextCursor`, `totalCount`) is unchanged
- [ ] Compliance report user enrichment fetches each user once
- [ ] Tests assert filtering/pagination correctness and pass
- [ ] `cd packages/backend && bun run lint` exits 0
- [ ] `cd packages/backend && bun run test:once` exits 0
- [ ] No out-of-scope files modified except an optional additive index (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Preserving the exact `nextCursor`/`totalCount` contract is incompatible with bounded querying (e.g. UI needs an exact total across the full table) — report so the contract can be revisited rather than reintroducing the full collect.
- A required filter has no supporting index and capping the scan would change results the UI relies on.
- A cited excerpt doesn't match the live code (drift).

## Maintenance notes

- `totalCount` over an unbounded table is fundamentally at odds with pagination performance. If exact totals are needed long-term, add a maintained counter (per org) updated on audit write. Note this as deferred.
- Reviewers: watch for new `.collect()` calls on `auditLog`, `mediaFiles`, `notifications`, `collections` — these grow with usage and should use indexed pagination from the start.
