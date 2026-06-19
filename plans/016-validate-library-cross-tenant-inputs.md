# Plan 016: Reject cross-organization library circulation inputs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/convex/library/circulation.ts packages/backend/convex/library/holds.ts packages/backend/convex/library/copies.ts packages/backend/convex/library/fines.ts packages/backend/tests/libraryHolds.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug/security
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

Some library mutations derive the tenant from an account or existing workflow
record, but accept item/copy/location IDs separately. Without explicit
organization equality checks, a valid account from org A can be combined with a
copy or item from org B, creating mixed-tenant circulation or hold records and
corrupting availability counts.

## Current state

- `packages/backend/convex/library/circulation.ts` — checkout derives
  organization from the account, then patches the passed copy/item without
  verifying they belong to that same organization.

```text
circulation.ts:39 await requireModuleEnabled(ctx, account.organizationId, "library");
circulation.ts:62 const copy = await ctx.db.get(args.copyId);
circulation.ts:69 const item = await ctx.db.get(copy.itemId);
circulation.ts:89 ctx.db.patch(args.copyId, { status: "checked_out" }),
circulation.ts:94 const circulationId = await ctx.db.insert("circulations", {
circulation.ts:95   organizationId: account.organizationId,
```

- `packages/backend/convex/library/holds.ts` — hold placement inserts under
  `account.organizationId` while accepting `args.itemId`.

```text
holds.ts:49 await requireModuleEnabled(ctx, account.organizationId, "library");
holds.ts:51 const item = await ctx.db.get(args.itemId);
holds.ts:112 const holdId = await ctx.db.insert("libraryHolds", {
holds.ts:113   organizationId: account.organizationId,
holds.ts:115   itemId: args.itemId,
```

Repo convention: earlier plans closed similar cross-tenant IDOR/data-integrity
gaps by loading each referenced document and checking `doc.organizationId`
matches the authoritative organization before any write.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Target tests | `cd packages/backend && bunx vitest run libraryHolds library-circulation-rules` | pass |
| Backend tests | `cd packages/backend && bun run test:once` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/library/circulation.ts`
- `packages/backend/convex/library/holds.ts`
- Related library mutations that combine account/hold/circulation tenant with
  item/copy/location IDs: `copies.ts`, `fines.ts`
- `packages/backend/tests/libraryHolds.test.ts`
- Optional new test file: `packages/backend/tests/libraryTenantIntegrity.test.ts`

**Out of scope**:
- UI changes.
- Broad authorization refactor from plan 015.
- Data repair for records already corrupted in production; report if found.

## Git workflow

- Branch: `advisor/016-library-tenant-integrity`
- Commit message example: `fix(library): reject cross-tenant circulation inputs`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add local guard helpers

Add small helpers near the affected functions or under `library/utils/`:

- `assertSameOrganization(docOrganizationId, expectedOrganizationId, label)`.
- Optionally `loadLibraryItemForOrg(ctx, itemId, organizationId)` and
  `loadCopyForOrg(ctx, copyId, organizationId)`.

Use typed `Id<"organizations">`; do not use `as any` or suppressed type errors.

**Verify**: `bun run typecheck` -> exit 0.

### Step 2: Guard checkout and override paths

In `circulation.ts`, after loading `copy` and `item`, validate:

- `copy.organizationId === account.organizationId`
- `item.organizationId === account.organizationId`
- `copy.itemId === item._id`

Apply the same pattern to checkout override and recall paths that accept account
plus item/copy/circulation IDs.

**Verify**: `cd packages/backend && bunx vitest run library-circulation-rules` -> pass.

### Step 3: Guard hold placement and pickup locations

In `holds.ts`, validate:

- `item.organizationId === account.organizationId`
- supplied `pickupLocationId`, if present, belongs to the same organization.
- account `preferredBranch`, if used as fallback, belongs to the same
  organization when the location exists.

Do this before inserting a hold.

**Verify**: `cd packages/backend && bunx vitest run libraryHolds` -> pass.

### Step 4: Add negative tests

Create two library-enabled orgs in a convex-test fixture. Use an authed user who
belongs to org A. Insert account/patron records for org A and items/copies for
org B.

Required tests:
- `api.library.circulation.checkout` rejects org A account + org B copy.
- `api.library.holds.place` rejects org A account + org B item.
- `api.library.holds.place` rejects org A account + org A item + org B pickup
  location.

Assert the thrown error includes a stable message such as
`belongs to a different organization`.

**Verify**: `cd packages/backend && bunx vitest run libraryTenantIntegrity libraryHolds` -> pass.

### Step 5: Full verification

Run:

```bash
bun run typecheck
bun run lint
cd packages/backend && bun run test:once
```

All commands must exit 0.

## Test plan

The new tests must prove mixed-tenant records cannot be created. Existing
library holds lifecycle tests must continue to pass for same-tenant data.

## Done criteria

- [ ] Checkout and hold placement reject mismatched tenant inputs before writes.
- [ ] Pickup locations are tenant-checked.
- [ ] Cross-tenant negative tests exist and pass.
- [ ] Full typecheck, lint, and backend tests pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- You find existing production data repair is required for mixed-tenant records.
- Fixing a path requires changing the account/member model.
- A cited excerpt no longer matches live code.

## Maintenance notes

Any future library mutation accepting multiple document IDs should choose one
authoritative tenant and validate every other document against it before writes.
