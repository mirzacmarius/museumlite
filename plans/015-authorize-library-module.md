# Plan 015: Require tenant authorization across public library functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/convex/library packages/backend/convex/utils/featureGates.ts packages/backend/convex/utils/permissions.ts packages/backend/tests`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

Most public library functions check only that the target organization has the
library module enabled. That is a feature-availability check, not an
authorization check. Any authenticated user who can obtain a library-enabled
organization ID can call reads and writes against that tenant unless each
function also proves membership or a permission.

## Current state

- `packages/backend/convex/utils/featureGates.ts` — module gate helper.

```text
featureGates.ts:81 export async function requireModuleEnabled(
featureGates.ts:86   const org = await getOrganization(ctx, organizationId);
featureGates.ts:87   if (!hasOrganizationModuleEnabled(org, moduleId)) {
```

- `packages/backend/convex/library/items.ts` — public library catalog mutations
  authenticate the caller but then only call `requireModuleEnabled`.

```text
items.ts:108 const userId = await getAuthUserId(ctx);
items.ts:113 await requireModuleEnabled(ctx, args.organizationId, "library");
items.ts:115 const itemId = await ctx.db.insert("libraryItems", {
```

- `packages/backend/convex/library/settings.ts` — settings read/update use the
  same module-only gate.

```text
settings.ts:47 await requireModuleEnabled(ctx, args.organizationId, "library");
settings.ts:88 const userId = await getAuthUserId(ctx);
settings.ts:93 await requireModuleEnabled(ctx, args.organizationId, "library");
```

- `packages/backend/convex/library/reports.ts` — dashboard reports read tenant
  library data after only `requireModuleEnabled`.

```text
reports.ts:15 await requireModuleEnabled(ctx, args.organizationId, "library");
reports.ts:28 const items = await ctx.db
reports.ts:29   .query("libraryItems")
```

Repo convention: permission-bearing backend functions call
`requirePermission(ctx, organizationId, "<permission>")`; see
`packages/backend/convex/library/acquisitions.ts`, which combines
`requireModuleEnabled` with `requirePermission`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Locate bare library gates | `rg -n "requireModuleEnabled\\(ctx, .*\\\"library\\\"" packages/backend/convex/library` | remaining matches are paired with authorization or intentionally internal |
| Target tests | `cd packages/backend && bunx vitest run libraryHolds library` | pass |
| Backend tests | `cd packages/backend && bun run test:once` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/library/*.ts`
- `packages/backend/convex/library/**/*.ts`
- `packages/backend/tests/library*.test.ts`
- Shared helper file if needed: `packages/backend/convex/utils/featureGates.ts`
  or a new helper under `packages/backend/convex/library/utils/`

**Out of scope**:
- Any UI change.
- Reworking the global role/permission model beyond mapping library functions to
  existing permissions.
- Patron self-service product design. If a public patron portal is required,
  STOP and report instead of keeping broad public access.

## Git workflow

- Branch: `advisor/015-authorize-library-module`
- Commit message example: `fix(library): require tenant permissions on public functions`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Classify public library functions

For each public export in `packages/backend/convex/library`, classify it as:
read, write, manage/settings, or patron self-service. Start with this mapping:

- Reads: `items.get/list/getByIsbn/getByBarcode/getStats`,
  `copies.get/listByItem/getByBarcode/generateBarcode`, `holds.get/list*`,
  `circulation.get/list*`, `fines.get/list/getPaymentHistory/getStatistics`,
  `reports.*`, `vendors.getStatistics`, `settings.get/listMembershipTypes`.
- Writes: catalog/copy/hold/circulation/fine/vendor/acquisition creates and
  updates.
- Manage/settings: `library/settings.ts` update and membership type mutations.

Use existing permissions first: `collections.read`, `collections.create`,
`collections.update`, `collections.delete`, `accounts.read`, `accounts.write`,
`organization.manage_settings`.

**Verify**: `rg -n "export const .* = (query|mutation|action)" packages/backend/convex/library` -> every public function has a row in your local mapping notes.

### Step 2: Add a permission-bearing library helper

Create a small helper such as `requireLibraryPermission(ctx, organizationId,
permissionName)` that first calls `requireModuleEnabled(ctx, organizationId,
"library")` and then `requirePermission(ctx, organizationId, permissionName)`.
Keep it typed with the repo's existing permission string type if available; do
not introduce `any`.

Do not change `requireModuleEnabled` semantics globally; non-library modules may
still use it as a feature gate.

**Verify**: `bun run typecheck` -> exit 0.

### Step 3: Replace bare public library gates

Replace public read/write/manage calls to `requireModuleEnabled(..., "library")`
with the new permission-bearing helper. Leave internal mutations that are only
called by crons or other authorized code alone if they do not accept arbitrary
user input.

For functions that derive `organizationId` from a loaded document, authorize
after loading the document and before returning or mutating tenant data.

**Verify**: `rg -n "requireModuleEnabled\\(ctx, .*\\\"library\\\"" packages/backend/convex/library` -> inspect every remaining match; each must be internal-only or accompanied by a nearby permission check.

### Step 4: Add cross-tenant authorization tests

Extend existing library tests or create `packages/backend/tests/libraryAuth.test.ts`.
Model setup after `packages/backend/tests/libraryHolds.test.ts`.

Required negative cases:
- User from org A cannot call `api.library.items.list` for org B.
- User from org A cannot create a library item in org B.
- User from org A cannot read `api.library.reports.getDashboardStats` for org B.
- User from org A cannot update `api.library.settings.update` for org B.

Expected failures should assert authorization errors, not just any thrown error.

**Verify**: `cd packages/backend && bunx vitest run libraryAuth libraryHolds` -> pass.

### Step 5: Full verification

Run:

```bash
bun run typecheck
bun run lint
cd packages/backend && bun run test:once
```

All commands must exit 0.

## Test plan

- Add cross-tenant negative tests for list/create/report/settings.
- Keep existing library holds lifecycle tests passing.
- If fixing this reveals existing placeholder tests, do not solve all test debt
  here; plan 019 covers that.

## Done criteria

- [ ] Public library reads/writes prove tenant membership or permission, not only
      module-enabled state.
- [ ] Cross-tenant tests fail before the fix and pass after it.
- [ ] `bun run typecheck`, `bun run lint`, and backend tests exit 0.
- [ ] No UI files are modified.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- A function is intentionally callable by non-members or patrons, and there is
  no existing account-ownership model to authorize it narrowly.
- The fix requires adding new global permissions or a large role migration.
- Any cited current-state excerpt no longer matches the code.

## Maintenance notes

Future library features must not use `requireModuleEnabled` as authorization.
Reviewers should grep for new bare library gates on every library PR.
