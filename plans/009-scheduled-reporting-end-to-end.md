# Plan 009: Make scheduled reporting real — one report type end-to-end

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e3f1d1a..HEAD -- packages/backend/convex/reporting.ts packages/backend/convex/crons.ts packages/backend/convex/dashboard.ts apps/app/src/app`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6e3f1d1a`, 2026-06-12

## Why this matters

"Reporting" is a paid Pro feature (`packages/backend/convex/utils/featurePolicy.ts:41`
maps `reporting: "pro"`; the marketing pricing page lists "Reporting & public portal"
under Pro in `apps/web/src/lib/pricing-plans.ts:68`). The backend has a complete
scheduled-reports CRUD surface, but the actual report generation is a stub that stores
placeholder data, no cron ever processes due reports, email delivery is a TODO, and no
frontend page calls any of it. Customers paying for "reporting" get dashboards and CSV
downloads, not the scheduled reports the schema promises. This plan delivers **one
report type end-to-end** (data generation → cron scheduling → minimal management UI)
so the feature is real, and leaves the remaining report types as documented follow-ups.

## Current state

- `packages/backend/convex/reporting.ts` — scheduled-reports module. Full CRUD exists
  (`createScheduledReport` at line 56, plus `updateScheduledReport`,
  `deleteScheduledReport`, `listScheduledReports`, `runReportManually`,
  `listReportRuns` further down). Eleven report types are declared:

```13:25:packages/backend/convex/reporting.ts
const reportTypeValidator = v.union(
  v.literal("collection_health"),
  v.literal("conservation_status"),
  v.literal("insurance_coverage"),
  v.literal("location_utilization"),
  v.literal("loan_performance"),
  v.literal("accession_activity"),
  v.literal("deaccession_activity"),
  v.literal("media_rights"),
  v.literal("compliance_audit"),
  v.literal("operational_kpis"),
  v.literal("custom"),
);
```

- The internal generator is a placeholder — this is the core gap:

```566:574:packages/backend/convex/reporting.ts
    try {
      // Generate report data based on type
      // This is a placeholder - actual report generation would query relevant data
      const reportData = {
        generatedAt: Date.now(),
        reportType: report.reportType,
        organizationId: report.organizationId,
        // Add report-specific data here
      };
```

  and at line 595: `// TODO: Send email if configured`.

- `packages/backend/convex/crons.ts` — nine cron jobs exist (insurance expiry, transit
  checks, conservation, loan reminders, SLA breaches, org deletions). **None** processes
  `scheduledReports.nextRunAt`. Scheduled reports therefore never run automatically.
- No frontend usage: `rg 'api\.reporting' apps/app/src` matches nothing relevant (one
  false positive in an accession form file from the word "reporting" in prose).
- The analytics page (`apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx`) is the
  natural UI home; it already gates on the same feature and consumes adjacent data:

```80:97:apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx
  const { hasFeature, hasModule } = useFeatureAccess();
  const hasReporting = hasFeature("reporting");
  const hasCompliance = hasFeature("compliance");
  const hasInventoryValuation = hasModule("inventory_valuation");

  const kpis = useQuery(
    api.dashboard.getOperationalKpis,
    currentOrganizationId && hasReporting
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
```

- Data sources you will reuse: `packages/backend/convex/dashboard.ts` exports
  `getOperationalKpis` and `getComplianceReport` (both public queries with full
  implementations). `reporting.ts` also imports `loadCatalogGrowthSnapshot` from
  `./utils/reportingCatalogAnalytics` (line 7).
- Repo conventions: Convex functions always declare `args` and `returns` validators;
  queries use `.withIndex()`, never `.filter()` on the DB; crons use
  `crons.interval(...)` with `internal.*` targets — see `packages/backend/convex/crons.ts`
  for the exact pattern. Tests use `convex-test` with the shared harness in
  `packages/backend/tests/testHarness.ts` — model new tests on
  `packages/backend/tests/conservation.test.ts:18-71`.

## Commands you will need

| Purpose   | Command (from repo root unless noted)         | Expected on success |
|-----------|-----------------------------------------------|---------------------|
| Lint      | `bun run lint`                                | exit 0              |
| Typecheck | `bun run typecheck`                           | exit 0              |
| Tests     | `cd packages/backend && bunx vitest run reporting` | all pass       |
| All tests | `cd packages/backend && bun test:once`        | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `packages/backend/convex/reporting.ts`
- `packages/backend/convex/crons.ts`
- `packages/backend/tests/reporting.test.ts` (extend)
- `apps/app/src/app/[locale]/(dashboard)/analytics/_components/scheduled-reports-card.tsx` (create)
- `apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx` (mount the new card)
- `apps/app/src/locales/en.ts`, `fr.ts`, `es.ts`, `no.ts`, `ro.ts` (new strings; mirror en into others, English fallback text is acceptable)

**Out of scope** (do NOT touch):
- Email delivery (`// TODO: Send email` stays a TODO — record it in maintenance notes;
  wiring Resend is a separate decision).
- PDF/Excel attachment generation (`attachmentFormat` stays accepted-but-unused).
- The other ten report types — implement **only** `operational_kpis`.
- `packages/backend/convex/dashboard.ts` — read-only dependency; do not modify.
- The marketing site (`apps/web`).

## Git workflow

- Branch: `advisor/009-scheduled-reporting`
- Conventional commits, e.g. `feat(reporting): generate operational_kpis scheduled reports`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Implement real generation for `operational_kpis`

In `packages/backend/convex/reporting.ts`, replace the placeholder block in
`generateReport` (lines ~566-574). For `report.reportType === "operational_kpis"`,
compute the same data `dashboard.getOperationalKpis` returns. Because `generateReport`
is an `internalMutation` and `getOperationalKpis` is a public query, extract the data
logic: read `dashboard.ts`, find the handler body of `getOperationalKpis`, move its
core into a plain exported helper function (e.g. `loadOperationalKpis(ctx, organizationId)`)
in `packages/backend/convex/dashboard.ts`'s own utils or a new
`packages/backend/convex/utils/operationalKpis.ts`, and call that helper from **both**
the existing query and `generateReport`. (Function-extraction refactor only — the
query's public behavior and return shape must not change.)

For any other `reportType`, keep current placeholder behavior but add a
`generatorVersion: "stub"` marker field so stub runs are distinguishable.

**Verify**: `bun run typecheck` → exit 0. `cd packages/backend && bunx vitest run dashboard` → existing dashboard tests still pass.

### Step 2: Add the cron that processes due reports

In `reporting.ts`, add an `internalMutation` named `processDueReports`:
- Query `scheduledReports` where `nextRunAt <= Date.now()` and `isActive` is true
  (check the schema for the exact field names/indexes — `packages/backend/convex/schema.ts`,
  table `scheduledReports`; if there is no index covering `nextRunAt`, take a bounded
  scan via the organization index and document it, or add an index
  `by_active_and_next_run` to the table in `schema.ts`).
- For each due report: insert a `reportRuns` row (status `running`, mirroring what
  `runReportManually` does — read that function first and reuse its row shape), then
  call the existing generation path (`ctx.scheduler.runAfter(0, internal.reporting.generateReport, { runId, reportId })`
  or direct call, matching how `runReportManually` invokes it).
- Cap each cron tick at 25 reports to bound the transaction.

In `crons.ts`, register:

```typescript
crons.interval(
  "process-due-scheduled-reports",
  { minutes: 15 },
  internal.reporting.processDueReports,
);
```

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 3: Minimal management UI on the analytics page

Create `scheduled-reports-card.tsx` under
`apps/app/src/app/[locale]/(dashboard)/analytics/_components/`, following the
structure of the sibling `report-exports-card.tsx` (read it first for card layout,
i18n usage, and shadcn imports). The card must:
- List existing schedules via `api.reporting.listScheduledReports`.
- Create a schedule via `api.reporting.createScheduledReport` with a small form:
  name, schedule (daily/weekly/monthly), report type fixed to `operational_kpis`
  (single option for now).
- Delete via `api.reporting.deleteScheduledReport`; trigger a manual run via
  `api.reporting.runReportManually`; show last-run status from `listReportRuns`.

Mount the card in `analytics/page.tsx` next to `ReportExportsCard`, using the same
`dynamic()` import pattern and gated by the existing `hasReporting` flag. Add new
locale keys under the existing `analytics` section of `en.ts` and mirror them to the
other four locale files.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 4: Tests

Extend `packages/backend/tests/reporting.test.ts` (it exists with real DB-level tests —
read it and follow its setup pattern, plus `conservation.test.ts:18-38` for the
permission harness):
1. `createScheduledReport` then invoke `internal.reporting.generateReport` via
   `t.mutation`/`t.run` → the `reportRuns` row has `status: "success"` and its
   `reportData` contains real KPI fields (not just `generatedAt`/`reportType`).
2. `processDueReports` with one report whose `nextRunAt` is in the past → a run row is
   created and `nextRunAt` advances into the future.
3. `processDueReports` with no due reports → no new run rows.

**Verify**: `cd packages/backend && bunx vitest run reporting` → all pass, including 3 new tests.

### Step 5: Full gates

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0;
`cd packages/backend && bun test:once` → all pass.

## Test plan

Covered in Step 4. Pattern files: `packages/backend/tests/reporting.test.ts` (existing
structure), `packages/backend/tests/conservation.test.ts` (auth/permission harness).

## Done criteria

- [ ] `bun run typecheck` and `bun run lint` exit 0
- [ ] `cd packages/backend && bun test:once` exits 0; ≥3 new reporting tests pass
- [ ] `grep -n "This is a placeholder" packages/backend/convex/reporting.ts` → no match for the `operational_kpis` path (stub marker for other types is fine)
- [ ] `grep -n "process-due-scheduled-reports" packages/backend/convex/crons.ts` → 1 match
- [ ] Analytics page renders a Scheduled Reports card gated by `hasFeature("reporting")`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `generateReport` in `reporting.ts` no longer matches the placeholder excerpt above
  (someone implemented it since this plan was written).
- The `scheduledReports` schema lacks fields this plan assumes (`nextRunAt`, an
  active/enabled flag) — report the actual shape instead of inventing one.
- Extracting `getOperationalKpis` into a shared helper would change its public return
  shape or require touching more than `dashboard.ts` + one new utils file.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Deferred**: email delivery (TODO at `reporting.ts:595`) — when wiring it, use the
  existing internal email actions pattern in `packages/backend/convex/email/actions.ts`;
  note `sendSubscriptionSuccessEmailAction` there is also currently unwired (see plan 013).
- **Deferred**: the other ten report types; each should reuse the helper-extraction
  pattern from Step 1 against its corresponding dashboard/domain query.
- Reviewers should scrutinize: the cron's scan bound (25/tick) and whether the
  `nextRunAt` advance is computed in the org's timezone (reuse `calculateNextRun`,
  which already takes a timezone parameter).
