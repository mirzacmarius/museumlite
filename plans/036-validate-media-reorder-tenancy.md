# Plan 036: Validate every media ID on reorder belongs to authorized org

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- packages/backend/convex/media.ts packages/backend/tests/media.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

`media.updateOrder` checks permission against only the first media ID's organization, then patches every ID in the array. A client could pass mixed-org IDs and reorder media outside their tenant while passing auth on the first ID.

## Current state

```text
packages/backend/convex/media.ts:858-869 — loads firstMedia from mediaIds[0], checks requirePermission on firstMedia.organizationId, then patches all mediaIds without per-item org check.
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Media tests | `cd packages/backend && bun test media.test.ts mediaEdits.test.ts` | all pass |
| Full backend tests | `cd packages/backend && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/media.ts` (`updateOrder` mutation)
- `packages/backend/tests/media.test.ts` or `mediaEdits.test.ts` (new test)

**Out of scope**:
- Other media mutations
- Frontend reorder UI

## Git workflow

- Branch: `advisor/036-validate-media-reorder-tenancy`
- Commit message: `fix(media): reject cross-org IDs in updateOrder`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Validate all media IDs before patching

After loading `firstMedia` and checking permission on `firstMedia.organizationId`:

1. Fetch every doc in `args.mediaIds` (can use `Promise.all` with `ctx.db.get`).
2. If any doc is missing, throw `Media not found`.
3. If any doc's `organizationId !== firstMedia.organizationId`, throw `Unauthorized` or `Media does not belong to this organization` (match repo error tone).
4. Only then run the existing patch loop.

**Verify**: handler contains explicit loop/check over all IDs before `Promise.all` patches.

### Step 2: Add regression test

Using convex-test pattern from `packages/backend/tests/media.test.ts`:
- Create two orgs with media files (or one org + attempt to include a foreign ID if fixture supports).
- Call `updateOrder` with mixed-org IDs; expect error.
- Call with same-org IDs; expect success.

**Verify**: targeted media tests pass.

### Step 3: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] All `mediaIds` validated for existence and org match before patch
- [ ] Regression test for mixed-org rejection
- [ ] typecheck, lint, backend tests pass
- [ ] Only in-scope files changed

## STOP conditions

- `updateOrder` renamed or removed
- Cannot construct two-org fixture in tests without out-of-scope helpers — report with what you tried

## Maintenance notes

Any future bulk media mutation should use the same validate-all-IDs pattern.
