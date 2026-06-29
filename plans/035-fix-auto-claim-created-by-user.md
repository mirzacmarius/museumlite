# Plan 035: Fix auto-claim createdBy user attribution

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- packages/backend/convex/insurance.ts packages/backend/tests/insurance.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can land before or after 034; coordinate if both touch same function)
- **Category**: correctness
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

Auto-claims set `createdBy` from `ctx.db.query("users").first()`, which attributes claims to an arbitrary user in the database — not the actor who triggered loan return damage.

## Current state

```text
packages/backend/convex/insurance.ts:1884-1908 — createdByUser = await ctx.db.query("users").first(); createdBy: createdByUser?._id
```

Schema requires `createdBy: v.id("users")` on `insuranceClaims` (`schema.ts:3620`).

Function is `internalMutation` and not yet called from other modules (grep confirms only definition site).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Insurance tests | `cd packages/backend && bun test insurance.test.ts` | all pass |
| Full backend tests | `cd packages/backend && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/insurance.ts` — `createAutoClaimForTransitDamage` args + handler
- Insurance tests asserting `createdBy`

**Out of scope**:
- Wiring loan-return caller to pass `actorUserId` (future feature work)
- Plan 034 claimedAmount fix (separate commit preferred; merge conflict likely if parallel — rebase)

## Git workflow

- Branch: `advisor/035-fix-auto-claim-created-by-user`
- Commit message: `fix(insurance): attribute auto-claims to actor user`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add actorUserId argument

Add to args:

```typescript
actorUserId: v.id("users"),
```

Remove `ctx.db.query("users").first()` from the `Promise.all` that fetches claimNumber.

### Step 2: Validate actor belongs to organization

Before insert, verify `actorUserId` is a member of `args.organizationId` (use existing membership helper/index pattern from `organizations.ts` or `lib/auth` — match repo conventions).

If not a member, throw `Unauthorized` / `User is not a member of this organization`.

Set `createdBy: args.actorUserId` (no cast, no optional).

### Step 3: Update tests

Call `internal.insurance.createAutoClaimForTransitDamage` with a known seeded user as `actorUserId`; assert inserted claim's `createdBy` equals that user.

**Verify**: insurance tests pass.

### Step 4: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] No `users.first()` for createdBy
- [ ] Required `actorUserId` validated for org membership
- [ ] Test asserts correct attribution
- [ ] typecheck, lint, backend tests pass
- [ ] Only in-scope files changed

## STOP conditions

- Schema change required to make `createdBy` optional (report — do not change schema in this plan)
- Membership validation helpers unavailable — report path tried

## Maintenance notes

When loan return flow schedules this internal mutation, pass the authenticated user who completed the return as `actorUserId`.
