# Plan 054: Pass client time into operational KPI queries

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 93c6f7e3..HEAD -- packages/backend/convex/utils/operationalKpis.ts packages/backend/convex/dashboard.ts packages/backend/convex/reporting.ts apps/app/src`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (extends plan 040 pattern; 040 did dashboard/reporting health dashboard, not operational KPIs)
- **Category**: bug
- **Planned at**: commit `93c6f7e3`, 2026-06-29

## Why this matters

Plan 040 removed `Date.now()` from several dashboard/reporting **query** handlers. `loadOperationalKpis` still calls `Date.now()` at `operationalKpis.ts:85` inside code invoked by the public query `dashboard.getOperationalKpis` (`dashboard.ts:863`). That breaks Convex query caching/reactivity and makes loan overdue buckets flicker on every subscription tick. Cron/report generation (`reporting.ts:619`) may keep execution-time `now`.

## Current state

- `packages/backend/convex/utils/operationalKpis.ts:85-89` — `const now = Date.now()` drives loan overdue and exhibition date windows.
- `packages/backend/convex/dashboard.ts:788-791` — `getOperationalKpis` args currently only `organizationId` (no `now`).
- Callers: `apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx:100`, `apps/app/src/app/[locale]/(dashboard)/loans/_components/kpi-overdue.tsx:35`.
- Tests: `packages/backend/tests/dashboard.test.ts:586+` — calls `getOperationalKpis` without `now`.
- `reporting.ts:619` — internal mutation path; pass `Date.now()` at call site (OK for mutations).

**Pattern exemplar**: plan 040 / `dashboard.ts` queries that now accept `now: v.number()`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Dashboard tests | `cd packages/backend && bun run test dashboard.test.ts` | all pass |
| Grep | `rg "Date\\.now\\(\\)" packages/backend/convex/utils/operationalKpis.ts` | no hits |
| Typecheck | `cd /Users/marius/Developer/ml && bun run typecheck` | exit 0 |
| Lint | `cd /Users/marius/Developer/ml && bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/utils/operationalKpis.ts` — add `now` parameter to `loadOperationalKpis`
- `packages/backend/convex/dashboard.ts` — `getOperationalKpis` args + pass-through
- `packages/backend/convex/reporting.ts` — pass `Date.now()` at mutation call site only
- `apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx`
- `apps/app/src/app/[locale]/(dashboard)/loans/_components/kpi-overdue.tsx`
- `packages/backend/tests/dashboard.test.ts`

**Out of scope**:
- Full-table `.collect()` perf in operational KPIs (PERF-10 — separate plan).
- Other queries in `operationalKpis` callers beyond `getOperationalKpis`.
- `archiveDetails.ts` / `library/holds.ts` `Date.now()` in queries (note in PR; separate tickets).

## Git workflow

- Branch: `advisor/054-pass-now-operational-kpis`
- Commit message: `fix(dashboard): pass now into operational KPI loader`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Thread `now` through loader

Change signature:

```typescript
export async function loadOperationalKpis(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  now: number,
): Promise<OperationalKpisData>
```

Remove `Date.now()` at line 85; use `now` for `todayStart`, loan buckets, exhibition filters.

**Verify**: `rg "Date\\.now\\(\\)" packages/backend/convex/utils/operationalKpis.ts` — zero matches.

### Step 2: Update `getOperationalKpis` query

Add required arg `now: v.number()` to `dashboard.ts:788-791`. Pass to `loadOperationalKpis(ctx, args.organizationId, args.now)`.

**Verify**: typecheck passes on backend.

### Step 3: Update internal mutation caller

In `reporting.ts` ~619, call `loadOperationalKpis(ctx, report.organizationId, Date.now())`.

**Verify**: typecheck passes.

### Step 4: Update frontend callers

Pass `{ organizationId, now: Date.now() }` to `useQuery(api.dashboard.getOperationalKpis, ...)` in both app files cited above.

**Verify**: `bun run typecheck --filter=@v1/app` or root typecheck passes.

### Step 5: Update tests

In `dashboard.test.ts`, pass fixed `now` timestamp (e.g. `1700000000000`) in `getOperationalKpis` calls; assert overdue counts stable relative to seeded loan `endDate` values.

**Verify**: `cd packages/backend && bun run test dashboard.test.ts` — pass.

### Step 6: Full gates

Lint + typecheck + backend tests.

## Test plan

- Update existing `getOperationalKpis` tests with explicit `now`.
- Optional: add one test asserting two queries with same `now` return identical overdue counts.

## Done criteria

- [ ] No `Date.now()` in `operationalKpis.ts`
- [ ] `getOperationalKpis` requires `now`; all callers updated
- [ ] Dashboard tests pass
- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] Only in-scope files modified

## STOP conditions

- `loadOperationalKpis` also called from other query handlers you didn't find — grep all references and update or STOP.
- Frontend caller is RSC-only without client boundary — pass `now` from server component props instead.

## Maintenance notes

- Any new consumer of `loadOperationalKpis` from a **query** must pass client/server `now`; mutations/crons use `Date.now()`.
- Historical KPI snapshot semantics (comparing live vs archived reports) remain a separate COR-09 follow-up.
