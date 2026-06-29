# Plan 040: Pass client time into dashboard and reporting queries

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat acb6dfa4..HEAD -- packages/backend/convex/dashboard.ts packages/backend/convex/reporting.ts apps/app/src`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `acb6dfa4`, 2026-06-29

## Why this matters

`Date.now()` inside Convex `query` handlers breaks caching/reactivity (Convex rule). Dashboard default date ranges and KPI windows recompute every millisecond.

## Current state

- `packages/backend/convex/dashboard.ts:199-201`, `:724-725` — `Date.now()` in query handlers
- `packages/backend/convex/reporting.ts:1095-1098` — `getCollectionHealthDashboard` uses `Date.now()`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Dashboard tests | `cd packages/backend && bun run test dashboard.test.ts reporting.test.ts` | all pass |
| Grep | `rg -n "Date\\.now\\(\\)" packages/backend/convex/dashboard.ts packages/backend/convex/reporting.ts` | no hits inside `query({` handlers (actions/mutations OK) |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/dashboard.ts` — affected queries
- `packages/backend/convex/reporting.ts` — `getCollectionHealthDashboard`
- Frontend callers that invoke these queries (pass `now: Date.now()` from client)

**Out of scope**: COR-09 historical KPI semantics (separate plan); cron/action handlers may keep `Date.now()`.

## Git workflow

- Branch: `advisor/040-pass-now-to-dashboard-queries`
- Commit message: `fix(dashboard): pass now from client into date-bounded queries`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add optional `now` args

For each affected query, add `now: v.optional(v.number())` (or required if simpler). Default behavior when omitted: use a documented fallback only if callers can't all be updated in same PR — prefer updating all callers.

Replace `Date.now()` with `args.now ?? <STOP if no callers updated>`.

**Verify**: grep shows no `Date.now()` in query handlers in scoped files.

### Step 2: Update client callers

Find `useQuery(api.dashboard.*` and `api.reporting.getCollectionHealthDashboard` in `apps/app`; pass `{ now: Date.now() }` (or use a small client hook that provides stable `now` per mount if needed).

**Verify**: typecheck passes on app + backend.

### Step 3: Update tests

Pass explicit `now` timestamp in convex-test query calls.

**Verify**: dashboard/reporting tests pass.

### Step 4: Full gates

Run lint, typecheck, backend tests.

## Done criteria

- [ ] No `Date.now()` in scoped query handlers
- [ ] Callers pass `now`
- [ ] Tests updated; CI gates pass
- [ ] Only in-scope files changed

## STOP conditions

- Query used from RSC without client — use server-passed `now` prop or action wrapper; report approach

## Maintenance notes

Document pattern in AGENTS.md Convex anti-patterns if not already present.
