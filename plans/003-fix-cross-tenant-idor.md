# Plan 003: Close cross-tenant data exposure (IDOR) on org and media functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/convex/organizations.ts packages/backend/convex/media.ts packages/backend/convex/utils/mediaAssets.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

Two cross-tenant flaws let one organization's user reach another organization's data:

1. **`organizations.get`** returns the full organization document (owner, settings, subscription tier, enabled modules, workflow flags) given only an org ID, with **no membership check**. Any authenticated user — or anyone, it's public — who obtains/guesses an org ID reads another tenant's internal configuration (IDOR + info disclosure).
2. **`media.create`** checks `media.upload` permission on `args.organizationId` but never verifies the target `collectionId` belongs to that org. A user with upload rights in org A can attach files to a collection in org B, injecting content into another tenant's catalog.

Both are classic multi-tenant isolation bugs. The fix is to verify ownership/membership of the referenced resource, matching the pattern used elsewhere in the backend.

## Current state

Auth pattern (canonical): `packages/backend/convex/media.ts:131-138` gets `userId` via `getAuthUserId` and calls `requirePermission(ctx, args.organizationId, "media.upload")`. The membership/permission helpers live in `packages/backend/convex/utils/permissions.ts` — read it to find the membership-only helper (e.g. `getCurrentUserOrganization` / `requireOrgMembership`).

### 3a. `organizations.get` — no membership check

`packages/backend/convex/organizations.ts:445-449`:

```typescript
handler: async (ctx, args) => {
  const org = await ctx.db.get(args.organizationId);
  return org;
},
```

Returns the entire org doc. Compare with `getBySlug` (line 510+) which deliberately returns a trimmed projection for the public portal. `get` returns everything including `ownerUserId`, `settings`, `subscriptionTier`.

**Caution**: `organizations.get` is widely called. A repo search is required before changing its contract: `rg -n "organizations.get\b|api\.organizations\.get" apps packages --glob '!node_modules' --glob '!_generated'`. Note `library/isbnLookup.ts:34` calls it inside `requireLibraryModule`. The fix must not break legitimate member reads.

### 3b. `media.create` — collection not bound to org

`packages/backend/convex/media.ts:131-178`: after `requirePermission(ctx, args.organizationId, "media.upload")`, it passes `args.collectionId` straight into `completeChunkedMediaAsset` / `insertCompletedMediaAsset` (`packages/backend/convex/utils/mediaAssets.ts:110`) without checking the collection's `organizationId`. Also check `generateUploadUrl` in `media.ts` (around line 77) for the same gap.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend lint | `cd packages/backend && bun run lint` | exit 0 |
| Backend tests | `cd packages/backend && bun run test:once` | all pass |
| Find org.get callers | `rg -n "api\.organizations\.get" apps packages --glob '!node_modules' --glob '!_generated'` | review list |

## Scope

**In scope**:
- `packages/backend/convex/organizations.ts` (`get` handler only)
- `packages/backend/convex/media.ts` (`create` and `generateUploadUrl` handlers)
- `packages/backend/convex/utils/mediaAssets.ts` (only if the org-binding check is cleaner there)
- New/updated tests in `packages/backend/tests/` or `packages/backend/convex/*.test.ts`

**Out of scope**:
- `getBySlug` and the public portal queries — handled by their own visibility flags.
- The media quota / MIME logic.
- Refactoring `requirePermission` itself.

## Git workflow

- Branch: `advisor/003-cross-tenant-idor`
- Conventional commits, e.g. `fix(backend): require org membership on organizations.get (IDOR)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the permissions helper

Read `packages/backend/convex/utils/permissions.ts`. Find the membership-only check (no specific permission) used for "is this user in this org". You'll reuse it in both fixes.

### Step 2 (3a): Require membership in `organizations.get`

- In the `get` handler, add `const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");` and verify membership in `args.organizationId` before returning the doc.
- **Before doing this**, run the caller search. If `get` is called from contexts where the user may legitimately not yet be a member (e.g. invitation acceptance, or `isbnLookup`'s module check passing an org the user belongs to), confirm those callers are members at call time. If any caller needs org data **without** membership (e.g. a public/onboarding path), STOP and report — the contract change is broader than this plan.
- Keep the return shape identical for members (do not trim fields in this plan; trimming non-admin fields is a separate hardening).

**Verify**: `cd packages/backend && bun run test:once` → pass (fix any test that called `get` without seeding membership by seeding it).

### Step 3 (3b): Bind media uploads to the collection's org

- In `media.create`, after the permission check and before inserting, load the collection: `const collection = await ctx.db.get(args.collectionId);` and throw unless `collection && collection.organizationId === args.organizationId`.
- Apply the same guard in `generateUploadUrl` if it accepts a `collectionId`.
- If the insert is centralized in `utils/mediaAssets.ts`, the check can live there instead — but it must run for every caller path (chunked and non-chunked).

**Verify**: `cd packages/backend && bun run lint` → exit 0.

## Test plan

- **organizations.get**: add a test asserting a member can read their org and a non-member gets "Not authenticated"/authorization error. Model after existing org tests in `packages/backend/tests/` (search for `organizations` test files).
- **media.create**: add a test where a user with `media.upload` in org A passes a `collectionId` belonging to org B and expects a thrown error; plus the happy path (own-org collection succeeds). Model after existing media/collection test setup.
- Verification: `cd packages/backend && bun run test:once` → all pass including new tests.

## Done criteria

- [ ] `organizations.get` throws for non-members; members still receive the doc
- [ ] `media.create` (and `generateUploadUrl` if applicable) reject a `collectionId` from a different org
- [ ] New tests cover both cross-tenant rejections and happy paths
- [ ] `cd packages/backend && bun run lint` exits 0
- [ ] `cd packages/backend && bun run test:once` exits 0
- [ ] No out-of-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- A caller of `organizations.get` legitimately needs org data without membership (onboarding, public portal, invitation preview) — adding the gate would break it; report the caller list so a scoped projection can be designed instead.
- The membership helper does not exist and adding it requires touching files outside scope.
- Any cited excerpt doesn't match the live code (drift).

## Maintenance notes

- Every public Convex function that accepts a foreign-key ID (`collectionId`, `loanId`, etc.) alongside `organizationId` must verify the referenced row's `organizationId` matches — passing the permission check on `organizationId` alone is insufficient. This is a recurring class; consider a shared `assertBelongsToOrg(ctx, doc, organizationId)` helper in a follow-up.
- Reviewers: scrutinize any new query that does `ctx.db.get(args.someId)` and returns it without an org/ownership check.
