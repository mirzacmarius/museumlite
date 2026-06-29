# Plan 052: Bound catalog list search path (stop full-org collect)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 93c6f7e3..HEAD -- packages/backend/convex/collections.ts packages/backend/tests/collections.test.ts apps/app/src`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `93c6f7e3`, 2026-06-29

## Why this matters

When the catalog list query uses a search term or composite filters (culture, period, materials, date range, etc.), it falls through to a manual path that `.collect()`s the entire org catalog — twice when searching (search index + full org scan). Latency and read units scale with collection size, not page size. Plan 018 fixed native `.paginate()` for simple index-only paths; this plan fixes the **search/composite fallback** at `collections.ts:1837-2055`.

## Current state

- `packages/backend/convex/collections.ts:1745-1835` — fast indexed `.paginate()` paths (keep unchanged).
- `packages/backend/convex/collections.ts:1857-1912` — search path:
  - Line 1874: `searchQuery.collect()` — unbounded search index read.
  - Line 1890: `filteredQuery.collect()` — full org table read for secondary field matching.
- `packages/backend/convex/collections.ts:1955` — non-search composite filters also `.collect()`.
- `packages/backend/convex/collections.ts:2039-2054` — in-memory slice pagination after materializing all results.
- `collections.search` query (`:2063+`) has a similar org-wide `.collect()` for secondary fields — **out of scope** unless trivial to share helper.

**Exemplar**: indexed pagination + enrichment in same file at `:1747-1759` via `toCollectionListPaginationResult`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Collections tests | `cd packages/backend && bun run test collections.test.ts` | all pass |
| Pagination regression | `cd packages/backend && bun run test -t "paginate"` | relevant tests pass |
| Typecheck | `cd /Users/marius/Developer/ml && bun run typecheck` | exit 0 |
| Lint | `cd /Users/marius/Developer/ml && bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/collections.ts` — `list` query fallback branch only (~1837-2055)
- `packages/backend/tests/collections.test.ts` — add bounded-search regression tests

**Out of scope**:
- `collections.search` autocomplete query (separate follow-up PERF-02).
- Public portal catalog (`getPublicCatalog` — PERF-05).
- Schema/index changes unless strictly required and documented.
- Frontend changes unless return shape changes (should not).

## Git workflow

- Branch: `advisor/052-bound-catalog-search-list`
- Commit message: `perf(collections): bound search list path reads`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Bound search-index reads

In the search branch (`args.search` non-empty):

Replace `searchQuery.collect()` with a bounded read. Use `.take(MAX_SEARCH_HITS)` where `MAX_SEARCH_HITS` is a named constant (recommend `500`, matching plan 018 search window).

**Verify**: `rg "searchQuery\\.collect\\(\\)" packages/backend/convex/collections.ts` — no matches.

### Step 2: Replace full-org collect for secondary field matching

Instead of loading all org collections (`:1890`), query targeted indexes:

- Accession partial match: use `by_accessionNumber` index with org filter where possible, or scan with `.take(MAX_SECONDARY_SCAN)` on `by_organization` with early exit when enough IDs collected.
- For description/objectName/culture/period/materials/provenance: either
  - (A) expand search index fields in schema (STOP — out of scope unless product approves), or
  - (B) **bounded** secondary scan: `.take(500)` on `by_organization`, filter in TS, merge with search hits, dedupe by `_id`.

Document in code comment that secondary-field matches beyond the scan window may not appear — acceptable trade-off for v1 (matches plan 018 bounded search philosophy).

**Verify**: `rg "filteredQuery\\.collect\\(\\)" packages/backend/convex/collections.ts` — no matches in list handler.

### Step 3: Bound composite-filter collect path

For the non-search branch that still hits `:1955` (`allResults = await query.collect()`), apply the same `MAX_SEARCH_HITS` cap or refactor to use existing compound indexes (`by_organization_and_status`, `by_organization_and_location`, `by_organization_and_objectType`) when only one filter is active — mirror the early paginate branches above.

If multiple composite filters force the fallback, use `.take(500)` + document limitation.

**Verify**: no unbounded `.collect()` in the list handler fallback (grep `collections.ts` between lines 1837-2055).

### Step 4: Preserve pagination semantics

Keep manual cursor pagination (`:2039-2054`) but operate on the **bounded** `allResults` array. Ensure `continueCursor`/`isDone` behavior unchanged for clients.

**Verify**: existing pagination tests still pass.

### Step 5: Add regression tests

In `packages/backend/tests/collections.test.ts`:

1. Seed org with 60+ collections (use loop insert in `t.run`).
2. Call `api.collections.list` with `search` matching a title in item 55 — assert result appears in first page.
3. Call with search matching accession number not in search index title — assert bounded secondary path still finds it when within scan window.
4. Assert query completes without timeout (no full-table assumption in test).

Use `withIdentity` pattern from `accounts.test.ts`; grant `collections.read`.

**Verify**: `cd packages/backend && bun run test collections.test.ts` — pass.

### Step 6: Full gates

Run backend suite, lint, typecheck.

## Test plan

- At least 2 new tests in `collections.test.ts` covering search + pagination on seeded data.
- Re-run any plan 018 pagination tests if present in same file.

## Done criteria

- [ ] No unbounded `.collect()` in `collections.list` fallback branch
- [ ] `MAX_SEARCH_HITS` (or equivalent) constant documented in file
- [ ] New tests pass; backend suite passes
- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] No out-of-scope files modified

## STOP conditions

- Drift: list handler structure moved/refactored — re-read file and report before proceeding.
- Removing secondary-field search entirely would break documented product behavior — stop and propose schema search-index expansion instead.
- Bounded scan causes test failures for accession search on large fixtures — adjust constant or index strategy; do not revert to full collect.

## Maintenance notes

- If search index gains more fields later, shrink secondary scan window.
- Reviewer should verify read units in Convex dashboard on a large org fixture if available.
- `collections.search` autocomplete remains a separate perf follow-up.
