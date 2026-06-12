# Plan 002: Add authorization to four exposed public Convex functions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/convex/webhooksActions.ts packages/backend/convex/apiKeys.ts packages/backend/convex/authLookup.ts packages/backend/convex/library/isbnLookup.ts`
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

Four public Convex functions perform sensitive work without verifying the caller is an authenticated member of the target organization. Public Convex functions are reachable by anyone with the deployment URL. Concretely: `webhooksActions.test` lets an unauthenticated caller make the server POST to an arbitrary URL (SSRF) using only a guessable webhook ID; `apiKeys.validate` is a public oracle for brute-forcing API keys and leaks the org ID + permission set on a hit; `authLookup.hasPasswordAccountForEmail` confirms whether any email is registered (account enumeration); and `isbnLookup.lookupIsbn` (plus its siblings) lets anyone with an org ID burn the org's external Open Library quota as an open proxy. Each needs an auth/membership gate consistent with the rest of the backend.

## Current state

The repo's standard auth pattern: `getAuthUserId(ctx)` (from `@convex-dev/auth/server`) returns the user ID or null; `requirePermission(ctx, organizationId, "<perm>")` (from `packages/backend/convex/utils/permissions.ts`) throws if the user is not a member with that permission. See `packages/backend/convex/media.ts:131-138` for the canonical pattern:

```typescript
const userId = await getAuthUserId(ctx);
if (!userId) {
  throw new Error("Not authenticated");
}
await requirePermission(ctx, args.organizationId, "media.upload");
```

For **actions** (which have no `ctx.db`), membership must be checked via a query. The action pattern: call `getAuthUserId(ctx)` for the identity, then run an internal/public query that verifies membership. Note `isbnLookup.ts` is an action file; `webhooksActions.ts` is an action file; `apiKeys.ts` and `authLookup.ts` are query/mutation files with direct `ctx.db` access.

### 2a. `webhooksActions.test` — SSRF, no auth

`packages/backend/convex/webhooksActions.ts:10-80` — public `test` action. It calls `ctx.runQuery(internal.webhooks.getInternal, { webhookId })` then `fetch(webhook.url, ...)`. No `getAuthUserId`, no org check. The webhook document has an `organizationId` (verify in `packages/backend/convex/webhooks.ts` / schema).

### 2b. `apiKeys.validate` — public key-validation oracle

`packages/backend/convex/apiKeys.ts:213-260` — public `validate` mutation. Takes a raw `apiKey`, hashes it, looks up by prefix, returns `{ valid, organizationId, permissions, keyId }` on match and patches `lastUsedAt`. No caller auth. **Note**: `packages/backend/convex/tests` / `packages/backend/tests/apiKeys.test.ts` calls `api.apiKeys.validate` directly (lines 271, 293, 322, 347) — those tests must be updated when this becomes internal.

### 2c. `authLookup.hasPasswordAccountForEmail` — account enumeration

`packages/backend/convex/authLookup.ts:4-35` — public query, takes an email, returns `{ hasPasswordAccount: boolean }`. No auth. Used by the login UI to branch between password and OAuth flows.

### 2d. `isbnLookup.lookupIsbn` (+ siblings) — org-scoped open proxy

`packages/backend/convex/library/isbnLookup.ts:52` (`lookupIsbn`), and the same pattern at ~`:392` and ~`:465`. Each only calls `requireLibraryModule(ctx, args.organizationId)` (lines 30-47), which checks the module is enabled via `api.organizations.get` — but never checks the caller is authenticated or a member. Then it fetches Open Library.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend lint | `cd packages/backend && bun run lint` | exit 0 |
| Backend typecheck | `cd packages/backend && bunx tsc --noEmit -p .` (or root `bun run typecheck`) | exit 0 |
| Backend tests | `cd packages/backend && bun run test:once` | all pass |

## Suggested executor toolkit

- Convex auth helpers: `getAuthUserId` from `@convex-dev/auth/server`; `requirePermission` and any membership helper in `packages/backend/convex/utils/permissions.ts` — read that file first to find an existing "is this user a member of this org" helper (look for something like `getCurrentUserOrganization` or `requireOrgMembership`).

## Scope

**In scope**:
- `packages/backend/convex/webhooksActions.ts`
- `packages/backend/convex/apiKeys.ts`
- `packages/backend/convex/authLookup.ts`
- `packages/backend/convex/library/isbnLookup.ts`
- `packages/backend/tests/apiKeys.test.ts` (update calls if `validate` is made internal)
- Frontend caller(s) of `hasPasswordAccountForEmail` and `apiKeys.validate` — update import path / call only if registration type changes (see steps).

**Out of scope**:
- The webhook signing logic (`signPayload`) and `internal.webhooks.getInternal` — leave as-is.
- API key hashing/generation internals (covered by a separate plan).
- The Open Library fetch/parse logic — only add an auth gate before it.

## Git workflow

- Branch: `advisor/002-authorize-public-endpoints`
- Commit per sub-area (002a/b/c/d) or one commit; conventional commits, e.g. `fix(backend): require auth on webhook test action (SSRF)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the permissions helper

Read `packages/backend/convex/utils/permissions.ts` in full. Identify (a) `requirePermission`'s signature, and (b) any helper that verifies plain org membership without a specific permission. You will reuse these rather than hand-rolling membership checks.

**Verify**: you can name the membership-check helper(s). (No command.)

### Step 2 (002a): Gate `webhooksActions.test` behind auth + org membership

In `webhooksActions.ts`, before calling `getInternal`/`fetch`:
- Get `userId = await getAuthUserId(ctx)`; if null, return `{ success: false, error: "Not authenticated" }` (keep the existing return shape; do not throw if the surrounding UI expects a result object — check the caller).
- Load the webhook's `organizationId` (the `getInternal` query likely already returns enough; if not, extend it to return `organizationId`, or add a dedicated internal membership check query). Verify the user is a member of that org with webhook-management permission. Find the permission string used by the webhook CRUD mutations in `packages/backend/convex/webhooks.ts` (e.g. `integrations.manage` or similar) and reuse it.
- Only then sign + fetch.

**Verify**: `cd packages/backend && bun run lint` → exit 0.

### Step 3 (002b): Make `apiKeys.validate` internal

API-key validation should happen inside trusted server code (HTTP actions / the API gateway), not from public clients.
- Change `validate` from `mutation` to `internalMutation` (import `internalMutation` from `./_generated/server`).
- Update `packages/backend/tests/apiKeys.test.ts`: replace `authed.mutation(api.apiKeys.validate, ...)` calls with `t.mutation(internal.apiKeys.validate, ...)` (import `internal` from `../convex/_generated/api`). Validation does not require an authenticated session, so use the base `t` test client, not `authed`.
- Search for any non-test caller: `rg -n "apiKeys.validate" apps packages --glob '!node_modules' --glob '!_generated'`. If an HTTP action in `http.ts` needs it, it can call `internal.apiKeys.validate` (HTTP actions can call internal functions). If a **frontend** caller exists, STOP (see STOP conditions).

**Verify**: `rg -n "api.apiKeys.validate" apps packages --glob '!node_modules' --glob '!_generated'` → no matches; `cd packages/backend && bun run test:once` → pass.

### Step 4 (002c): Stop account enumeration in `hasPasswordAccountForEmail`

This query backs a login-form branch, so it cannot simply require an authenticated session (the user is logging in). Two acceptable options — pick the one that matches how the login UI uses it:
- **Preferred if feasible**: remove the public query and have the login flow attempt the chosen auth method, showing a uniform message. Requires frontend change — only do this if the caller is simple.
- **Otherwise**: keep it but make it safe — add basic rate-limiting/uniform behavior is out of scope here; at minimum, narrow the return so it cannot be used to harvest (this query is inherently an oracle). If you cannot make it safe without a larger auth-flow refactor, **leave the code unchanged and record in `plans/README.md` that 002c is deferred with reason "needs login-flow redesign"**. Do not pretend-fix it.

Find the caller first: `rg -n "hasPasswordAccountForEmail" apps --glob '!node_modules'`.

**Verify**: either the query is gone and the login flow still type-checks (`bun run typecheck`), or 002c is explicitly marked deferred in the index.

### Step 5 (002d): Require membership in ISBN lookup actions

In `packages/backend/convex/library/isbnLookup.ts`, extend `requireLibraryModule` (or add a new `requireLibraryAccess`) to also verify the caller:
- Add `const userId = await getAuthUserId(ctx); if (!userId) throw new Error("Not authenticated");`
- Verify membership in `args.organizationId` via an internal query (actions have no `ctx.db`). Reuse the membership helper from Step 1, wrapped in a `ctx.runQuery` to an internal query if one exists; if not, add a small `internalQuery` in `permissions.ts` or `organizations.ts` that returns whether a user is a member of an org.
- Apply to all three lookup actions (`lookupIsbn` ~line 52, and the two at ~392 and ~465).

**Verify**: `cd packages/backend && bun run lint && bun run test:once` → exit 0, all pass.

## Test plan

- **apiKeys**: existing `packages/backend/tests/apiKeys.test.ts` must pass after switching `validate` calls to `internal.*`. Add one test asserting `internal.apiKeys.validate` still returns `{ valid: true, organizationId, permissions, keyId }` for a freshly created key and `{ valid: false }` for garbage.
- **isbnLookup**: add a test (model after an existing library test if present, else after `packages/backend/tests/apiKeys.test.ts` structure) asserting `lookupIsbn` throws "Not authenticated" when called without a session, and works for an org member. External fetch can be left to hit the real API only if existing tests do; otherwise assert the auth gate throws before fetch.
- **webhooksActions**: add a test asserting `test` returns `{ success: false, error: "Not authenticated" }` (or throws) for an unauthenticated caller.
- Verification: `cd packages/backend && bun run test:once` → all pass including new tests.

## Done criteria

- [ ] `webhooksActions.test` checks auth + org membership before fetch
- [ ] `apiKeys.validate` is `internalMutation`; `rg "api.apiKeys.validate" apps packages --glob '!_generated' --glob '!node_modules'` returns no matches
- [ ] `isbnLookup` actions check auth + membership before external fetch (all 3 sites)
- [ ] `hasPasswordAccountForEmail` is either hardened/removed OR marked deferred in `plans/README.md` with a reason
- [ ] `cd packages/backend && bun run lint` exits 0
- [ ] `cd packages/backend && bun run test:once` exits 0 with new tests
- [ ] No out-of-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- A **frontend** component calls `api.apiKeys.validate` (making it internal would break the UI — needs an authenticated server wrapper instead).
- The webhook `getInternal` query does not expose `organizationId` and there is no obvious internal membership query to add without touching out-of-scope files.
- Fixing `hasPasswordAccountForEmail` safely requires redesigning the login flow — defer it (per Step 4) rather than improvising.
- Any cited excerpt doesn't match the live code (drift).

## Maintenance notes

- New Convex actions/queries that take an `organizationId` must gate on membership, not just module-enabled checks. `requireLibraryModule`'s "module enabled" check is **not** an authorization check — reviewers should watch for this conflation.
- If an external public API for API-key validation is ever needed, build it as an authenticated HTTP action with rate limiting, never as a public Convex mutation.
