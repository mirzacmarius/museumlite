# Plan 053: Test reporting public API auth and feature gates

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat 93c6f7e3..HEAD -- packages/backend/convex/reporting.ts packages/backend/tests/reporting.test.ts packages/backend/tests/featureGates.test.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `93c6f7e3`, 2026-06-29

## Why this matters

`packages/backend/tests/reporting.test.ts` (~2300 lines) mostly inserts into `scheduledReports` via `ctx.db` and never calls `api.reporting.*`. The file's own comment (lines 8-11) says auth isn't mockable — but other modules (`accounts.test.ts`, `featureGates.test.ts`, `auditLog.test.ts`) use `t.withIdentity({ subject, issuer })` successfully with `getAuthUserId`. Reporting auth regressions on tier gating (`requireFeatureAccess`) and permissions would not fail CI today.

## Current state

- `packages/backend/tests/reporting.test.ts:8-11` — documents skipped auth testing.
- `packages/backend/convex/reporting.ts:92-105` — `createScheduledReport` requires auth + `requireFeatureAccess(..., "reporting")` + `organization.manage_settings`.
- `packages/backend/convex/reporting.ts:300-308` — `listScheduledReports` uses `requirePermission` (verify if `getAuthUserId` is also required — add test expectation matching live code).
- `packages/backend/convex/reporting.ts:416-439` — `runReportManually` auth stack.
- Working auth test pattern: `packages/backend/tests/accounts.test.ts:114-117` — `t.withIdentity({ subject: \`${userId}|session\`, issuer: "https://example.test" })`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Reporting auth tests | `cd packages/backend && bun run test reporting-auth` | all pass (new file) |
| Reporting suite | `cd packages/backend && bun run test reporting.test.ts` | all pass (existing tests unchanged) |
| Typecheck | `cd /Users/marius/Developer/ml && bun run typecheck` | exit 0 |
| Lint | `cd /Users/marius/Developer/ml && bun run lint` | exit 0 |

## Scope

**In scope**:
- New file: `packages/backend/tests/reporting-auth.test.ts`
- Optional: shared test helper extracted to `packages/backend/tests/helpers/reportingAuthFixture.ts` if duplication is heavy

**Out of scope**:
- Rewriting all 2300 lines of `reporting.test.ts` (TEST-16 — separate cleanup).
- Changing reporting handler auth logic (only add tests unless a bug is found — then fix minimally and document).
- Frontend hook tests (TEST-08).

## Git workflow

- Branch: `advisor/053-test-reporting-api-auth`
- Commit message: `test(reporting): cover public API auth and feature gates`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create auth fixture helper

Add helper (inline or separate file) that creates:
- Org A (pro tier) and Org B (free tier) with distinct slugs
- User with `organization.manage_settings` + `collections.read` on Org A
- User member of Org B with same permissions
- `userOrganizations` + role + rolePermissions rows

Copy structure from `accounts.test.ts` `createTestSetup` and `featureGates.test.ts` org tier setup (`createOrg(..., "free")` pattern if available).

**Verify**: helper compiles; typecheck passes.

### Step 2: Unauthenticated rejection tests

For each public export below, call via **unauthenticated** `t` (no `withIdentity`) and expect throw containing `"Not authenticated"` or the handler's actual message:

- `api.reporting.createScheduledReport`
- `api.reporting.listScheduledReports`
- `api.reporting.runReportManually`
- `api.reporting.getCollectionTrends` (or equivalent analytics query at `reporting.ts:694+`)
- `api.reporting.getCollectionHealthDashboard` (`:1031+`)

Use minimal valid args (orgId, name, reportType).

**Verify**: at least 5 tests fail if you temporarily remove `getAuthUserId` check — optional sanity check; do not commit that change.

### Step 3: Free-tier feature gate tests

With authenticated user on **free-tier** org, expect `createScheduledReport` and analytics queries to throw feature access error (grep `requireFeatureAccess` for exact message in `utils/featurePolicy.ts`).

**Verify**: 2+ tests pass.

### Step 4: Cross-org rejection tests

Authenticated user in Org A attempts `listScheduledReports` / `createScheduledReport` with Org B's `organizationId` — expect permission or membership error.

**Verify**: 2+ tests pass.

### Step 5: Happy path smoke test

Pro-tier org + authed user: `createScheduledReport` via `api.reporting.createScheduledReport` returns an ID; `listScheduledReports` returns the created row.

**Verify**: 1 test passes calling real handlers (not `ctx.db.insert`).

### Step 6: Full gates

Run new file + full reporting.test.ts + backend suite.

**Verify**: all pass; lint + typecheck green.

## Test plan

- New file with ≥10 test cases covering: unauthenticated (5 handlers), free-tier gate (2), cross-org (2), happy path (1).
- Pattern: `convexTest(schema, modules)` + `withIdentity` like `accounts.test.ts`.

## Done criteria

- [ ] `packages/backend/tests/reporting-auth.test.ts` exists and calls `api.reporting.*`
- [ ] Unauthenticated + tier + cross-org cases covered
- [ ] Existing `reporting.test.ts` still passes unchanged (or only comment updates)
- [ ] `bun run test:once` in backend passes
- [ ] `bun run typecheck` and `bun run lint` exit 0

## STOP conditions

- `withIdentity` does not populate `getAuthUserId` for reporting handlers in your environment — stop and report; propose testing `requireFeatureAccess`/`requirePermission` in isolation instead.
- Handler signatures differ from plan — read live `reporting.ts` exports and adjust test list; do not guess args.

## Maintenance notes

- When adding new public reporting exports, add a row to the auth test matrix.
- Full rewrite of DB-only tests in `reporting.test.ts` remains deferred (TEST-16).
