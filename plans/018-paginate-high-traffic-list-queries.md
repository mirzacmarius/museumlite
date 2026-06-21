# Plan 018: Replace full-table manual pagination in high-traffic list queries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/convex/accounts.ts packages/backend/convex/loans.ts packages/backend/convex/transit.ts packages/backend/convex/library/items.ts packages/backend/convex/appraisals.ts apps/app/src/app/[locale]/\\(dashboard\\)/accounts/page.tsx apps/app/src/app/[locale]/\\(dashboard\\)/loans/_components/loan-list.tsx apps/app/src/app/[locale]/\\(dashboard\\)/library/catalog/page.tsx packages/backend/tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

Several APIs accept `paginationOpts` but still collect every matching tenant row,
sort/filter in memory, and then slice by an offset cursor. Later pages pay for
the same full scan as the first page and can drift if records are inserted
between requests. The issue is now broad enough to plan as a focused scaling
pass across the most visible lists.

## Current state

- `accounts.list` collects all accounts and the accounts page calls it without
  pagination.

```text
accounts.ts:46 let results = await ctx.db
accounts.ts:52   .collect();
accounts.ts:90 if (args.paginationOpts) {
accounts/page.tsx:272 const accounts = useQuery(api.accounts.list, {
```

- `loans.list` collects all loans before filtering/search and page slicing.

```text
loans.ts:543 let allResults = await query.collect();
loans.ts:550 const loansWithCollectionInfo = await Promise.all(
loans.ts:583 const cursor = args.paginationOpts.cursor
```

- `transit.listTransitRecords` collects all transit records, then slices, then
  runs per-page item count queries.

```text
transit.ts:842 let allResults = await baseQuery.collect();
transit.ts:858 allResults.sort((a, b) => b.createdAt - a.createdAt);
transit.ts:870 const recordsWithDetails = await Promise.all(
```

- `library.items.list` combines search-index results with a full organization
  collect and also collects all rows for non-search filters.

```text
library/items.ts:243 results = await searchQuery.collect();
library/items.ts:246 const allItems = await ctx.db
library/items.ts:300 results = await query.collect();
library/items.ts:350 // Handle pagination manually
```

- `appraisals.list` enriches every appraisal before slicing.

```text
appraisals.ts:392 const [, appraisals] = await Promise.all([
appraisals.ts:399   .collect(),
appraisals.ts:405 let enrichedAppraisals = await Promise.all(
```

Previous plan 006 solved audit-log/compliance pagination; use that as the
semantic pattern where applicable.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Find manual pagination | `rg -n "paginationOpts|Number\\.parseInt\\(args\\.paginationOpts\\.cursor|\\.collect\\(\\)" packages/backend/convex/accounts.ts packages/backend/convex/loans.ts packages/backend/convex/transit.ts packages/backend/convex/library/items.ts packages/backend/convex/appraisals.ts` | confirms target sites |
| Target tests | `cd packages/backend && bunx vitest run accounts loans library transit appraisals` | pass or no matching test files except existing targets |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- Backend list queries in `accounts.ts`, `loans.ts`, `transit.ts`,
  `library/items.ts`, `appraisals.ts`
- Existing dashboard callers that need to switch to `usePaginatedQuery` or pass
  `paginationOpts`
- Focused tests for cursor behavior and search/filter parity

**Out of scope**:
- Object catalog search and collection-health report collects already listed in
  prior deferred findings.
- Per-object media storage URL fetches already listed in prior deferred
  findings.
- Full-text search redesign beyond bounded behavior for these lists.

## Git workflow

- Branch: `advisor/018-paginate-high-traffic-lists`
- Commit message example: `perf(backend): paginate high-traffic tenant lists`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Split non-search paths from search paths

For each target query, identify the no-search/no-complex-filter path that can
use Convex `.paginate(args.paginationOpts)` directly. Implement those first.
Prefer existing indexes:

- accounts: `by_organization`, `by_organization_and_accountType`
- loans: `by_organization`, `by_organization_and_status`
- transit: `by_organization`, `by_organization_and_status`,
  `by_organization_and_carrier`
- library items: `by_organization`, `by_organization_and_type`,
  `by_organization_and_status`
- appraisals: `by_organization`

If an index is missing for a common exact filter, add a schema index with a name
that includes all fields, following `AGENTS.md`.

**Verify**: `bun run typecheck` -> exit 0.

### Step 2: Bound search/partial-filter paths

For search fields that cannot be indexed immediately, do not collect unbounded
tenant tables. Choose one explicit behavior per query:

- use an existing search index and document which fields it covers; or
- scan a bounded recent window with `.take(limit)` and return a clear limited
  result; or
- add a denormalized searchable text field and update write paths/tests.

For this plan, prefer the smallest behavior-preserving approach. If preserving
all current fuzzy search semantics requires a denormalized migration, STOP and
split that into a dedicated search-index plan.

**Verify**: target query tests pass, or if no tests exist, add minimal tests in
the matching backend test file.

### Step 3: Fix dashboard callers

Update visible callers so they use paginated results correctly:

- `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx`
- `apps/app/src/app/[locale]/(dashboard)/loans/_components/loan-list.tsx`
- `apps/app/src/app/[locale]/(dashboard)/library/catalog/page.tsx`

Keep UI behavior minimal: load the first page and preserve existing search/filter
controls. Do not redesign list screens.

**Verify**: `bun run typecheck` -> exit 0.

### Step 4: Add regression tests

For at least accounts, loans, and library items, create enough rows to prove:

- first page returns `numItems`;
- second page uses `continueCursor`;
- exact filters still work;
- search behavior is documented by tests.

For transit/appraisals, add tests if a harness already exists; otherwise add a
small characterization test or note the gap in the plan row.

**Verify**: `cd packages/backend && bunx vitest run accounts loans library transit appraisals` -> pass for matching test files.

### Step 5: Full verification

Run:

```bash
bun run typecheck
bun run lint
cd packages/backend && bun run test:once
```

All commands must exit 0.

## Test plan

Add cursor regression tests for high-risk lists. At minimum, accounts, loans, and
library catalog must have positive pagination coverage.

## Done criteria

- [ ] No target list query collects all tenant rows before paginating for its
      normal non-search path.
- [ ] Search/partial-filter paths are bounded or indexed and covered by tests.
- [ ] Dashboard callers still typecheck.
- [ ] Full typecheck, lint, and backend tests pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- Preserving search semantics requires a denormalized search migration.
- A schema index change causes generated API drift that cannot be reconciled
  with `bunx convex codegen`.
- A cited excerpt no longer matches live code.

## Maintenance notes

Reviewers should reject new list APIs that accept `paginationOpts` but use
offset cursors over fully collected arrays.
