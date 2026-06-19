# Plan 017: Gate organization user, settings, and usage read helpers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/convex/organizations.ts packages/backend/tests/organizations.test.ts apps/app/src`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

Three public organization helpers read sensitive tenant metadata by caller-
supplied organization ID with no authentication or membership check. These
helpers are used by dashboard surfaces, so they should require the caller to be
a member or hold the appropriate permission. If a public portal needs a subset,
that subset should be a separate narrow query.

## Current state

- `packages/backend/convex/organizations.ts` — settings query returns org
  settings directly.

```text
organizations.ts:704 export const getSettings = query({
organizations.ts:755 handler: async (ctx, args) => {
organizations.ts:756   const org = await ctx.db.get(args.organizationId);
organizations.ts:757   return org?.settings ?? null;
```

- `getUsageStats` exposes subscription tier and usage counters.

```text
organizations.ts:764 export const getUsageStats = query({
organizations.ts:783 handler: async (ctx, args) => {
organizations.ts:784   const org = await ctx.db.get(args.organizationId);
```

- `listOrganizationUsers` enumerates users/roles by org ID.

```text
organizations.ts:1542 export const listOrganizationUsers = query({
organizations.ts:1565 const userOrganizations = await ctx.db
organizations.ts:1566   .query("userOrganizations")
organizations.ts:1567   .withIndex("by_organization", (q) =>
```

Known dashboard call sites:
`apps/app/src/app/[locale]/(dashboard)/settings/users/page.tsx`,
`apps/app/src/app/[locale]/(dashboard)/collections/new/page.tsx`,
`apps/app/src/app/[locale]/(dashboard)/media/media-page-data.tsx`,
`apps/app/src/components/plan-usage-stats.tsx`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Find callers | `rg -n "listOrganizationUsers|getSettings|getUsageStats" apps packages/backend --glob '!**/_generated/**'` | call sites identified |
| Target tests | `cd packages/backend && bunx vitest run organizations` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/organizations.ts`
- `packages/backend/tests/organizations.test.ts`
- Frontend call sites only if they need explicit empty/error handling after the
  backend is gated.

**Out of scope**:
- Public portal query redesign. If a public page needs org settings, create a
  follow-up or a narrow public projection only with user approval.
- Changes to role names or permission schema.

## Git workflow

- Branch: `advisor/017-gate-org-read-helpers`
- Commit message example: `fix(organizations): gate settings and user list reads`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Choose authorization levels

Use the smallest existing permission that matches each helper:

- `listOrganizationUsers`: require `organization.manage_settings` or an existing
  users read permission if present.
- `getSettings`: require `organization.manage_settings`.
- `getUsageStats`: require organization membership, or
  `organization.manage_settings` if no member-level helper exists.

Read `packages/backend/convex/utils/permissions.ts` before editing.

**Verify**: `rg -n "organization.manage_settings|users.read|checkOrgMembership" packages/backend/convex/utils/permissions.ts packages/backend/convex` -> confirms available helper/permission names.

### Step 2: Add backend gates

In `organizations.ts`, call the selected authorization helper before returning
data. For unauthenticated callers, prefer the repo's existing behavior for
similar dashboard queries: throw authorization errors rather than returning
partial sensitive data.

**Verify**: `bun run typecheck` -> exit 0.

### Step 3: Add negative tests

Extend `packages/backend/tests/organizations.test.ts`:

- Unauthenticated call to each helper is rejected or returns the existing
  unauthorized shape, matching repo conventions.
- User from org A cannot call each helper for org B.
- Authorized org member/admin still receives the expected settings, usage, and
  user list.

Do not assert exact user emails beyond test fixture values.

**Verify**: `cd packages/backend && bunx vitest run organizations` -> pass.

### Step 4: Check frontend callers

Run typecheck. If frontend callers assume these queries can return data before
auth/org context is ready, add minimal guards at the call sites. Do not redesign
pages.

**Verify**: `bun run typecheck` -> exit 0.

### Step 5: Full verification

Run:

```bash
bun run lint
cd packages/backend && bun run test:once
```

Both must exit 0.

## Test plan

Add authorization regression tests in `organizations.test.ts`, including
cross-tenant negative cases and same-tenant positive cases.

## Done criteria

- [ ] `getSettings`, `getUsageStats`, and `listOrganizationUsers` require auth
      and tenant authorization.
- [ ] Cross-tenant tests exist and pass.
- [ ] Dashboard callers still typecheck.
- [ ] Lint and backend tests pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- A public route truly needs one of these helpers unauthenticated.
- There is no existing member/permission helper that can express the intended
  access without a role-system migration.
- A cited excerpt no longer matches live code.

## Maintenance notes

Do not add broad org-ID based read helpers without an authorization check.
Split public projections from dashboard projections when needed.
