# Plan 001: Make destructive seed actions internal-only

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/convex/seedSingleOrg.ts packages/backend/convex/seedMetAction.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

The Convex backend exposes **public actions that wipe the entire database**. `clearAllData` in `seedSingleOrg.ts` deletes 80+ tables and all file storage, and `runSeed` in `seedMetAction.ts` triggers a full reset-and-reseed. Public Convex actions are callable by anyone who knows the deployment URL (which ships in the client bundle as `NEXT_PUBLIC_CONVEX_URL`) — no authentication is checked. A single anonymous request can destroy every tenant's data in production. These actions exist only for CLI seeding workflows, which still work with internal functions via `bunx convex run` (the CLI uses the deployment admin key, which can invoke internal functions).

## Current state

- `packages/backend/convex/seedSingleOrg.ts` — seed module with three **public** actions:
  - `clearAllData` (line 102): wipes all tables + storage, no auth check.
  - `seedOrganization` (line 227): creates an org with sample data, no auth check.
  - `runFullSeed` (line 483): full reset + seed, no auth check.
- `packages/backend/convex/seedMetAction.ts` — Met museum seed. `runSeed` (line ~11) is a **public** action wrapping `internal.seedMetAction.resetAndSeed`. The file already imports both `action` and `internalAction`.

Excerpt as of commit `12620298`:

```typescript
// packages/backend/convex/seedSingleOrg.ts:102
export const clearAllData = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Clearing all data...");
    const tablesToClear = [
      "auditLog",
      // ... 80+ tables ...
```

```typescript
// packages/backend/convex/seedMetAction.ts:11
export const runSeed = action({
  args: {},
  returns: v.union(v.null(), v.string()),
  handler: async (ctx) => {
    ...
    await ctx.runAction(internal.seedMetAction.resetAndSeed, {});
```

Callers: a repo-wide search (`rg -l "clearAllData|runSeed|seedOrganization|runFullSeed" --glob '!node_modules' --glob '!_generated'`) finds **no app-code callers** — only the two seed files themselves and `SEED_DATA_SUMMARY.md` (docs). The only usage is manual CLI: `bunx convex run seedMetAction:runSeed`.

Repo conventions: Convex functions always declare `args` and `returns` validators (see any module, e.g. `packages/backend/convex/contacts.ts`). Internal functions are registered with `internalAction`/`internalMutation` imported from `./_generated/server`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend lint | `cd packages/backend && bun run lint` | exit 0 |
| Backend tests | `cd packages/backend && bun run test:once` | all pass |
| Search for stragglers | `rg -n "export const (clearAllData\|runSeed\|seedOrganization\|runFullSeed) = action" packages/backend/convex` | no matches |

## Scope

**In scope** (the only files you should modify):
- `packages/backend/convex/seedSingleOrg.ts`
- `packages/backend/convex/seedMetAction.ts`
- `SEED_DATA_SUMMARY.md` (only if it documents the public invocation — update command examples)

**Out of scope** (do NOT touch):
- `packages/backend/convex/init.ts` — separate init flow, referenced by the `seed` npm script.
- `packages/backend/convex/migrations.ts` — already internal.
- Any other seed/demo data logic inside the two files — only change function registration, not seeding behavior.

## Git workflow

- Branch: `advisor/001-internalize-seed-actions`
- Commit style: conventional commits, e.g. `fix(backend): make destructive seed actions internal-only`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Convert public seed actions to internalAction

In `packages/backend/convex/seedSingleOrg.ts`:
- Change the import from `./_generated/server` to import `internalAction` (replace or extend the existing `action` import).
- Change `clearAllData`, `seedOrganization`, and `runFullSeed` from `action({...})` to `internalAction({...})`. Keep args/returns/handlers identical.
- If `seedOrganization` or `runFullSeed` call each other via `api.seedSingleOrg.*` references, switch those references to `internal.seedSingleOrg.*` (import `internal` from `./_generated/api` if not already imported).

In `packages/backend/convex/seedMetAction.ts`:
- Change `runSeed` from `action({...})` to `internalAction({...})`. The file already imports `internalAction`.
- Remove the now-unused `action` import if nothing else uses it.

**Verify**: `rg -n "= action\(" packages/backend/convex/seedSingleOrg.ts packages/backend/convex/seedMetAction.ts` → no matches.

### Step 2: Update CLI usage docs

The doc comment in `seedMetAction.ts` says `Usage: bunx convex run seedMetAction:runSeed` — this still works for internal functions via the CLI, so the comment stays valid; just confirm it. If `SEED_DATA_SUMMARY.md` shows invocation examples, they also remain valid (`convex run` can call internal functions); no changes needed unless they claim the function is public.

**Verify**: `cd packages/backend && bun run lint` → exit 0.

### Step 3: Run the backend test suite

**Verify**: `cd packages/backend && bun run test:once` → all tests pass (same pass count as on a clean checkout — run once before your change if you want a baseline).

## Test plan

No new tests required — this is a function-registration change with no behavior change for authorized (CLI) callers. The existing suite must stay green. Optionally add one assertion-free compile-time guard is unnecessary.

## Done criteria

- [ ] `rg -n "export const (clearAllData|runSeed|seedOrganization|runFullSeed) = action" packages/backend/convex` returns no matches
- [ ] `cd packages/backend && bun run lint` exits 0
- [ ] `cd packages/backend && bun run test:once` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any of the four functions is referenced via `api.seedSingleOrg.*` or `api.seedMetAction.*` from frontend code (`rg "api.seed" apps packages --glob '!node_modules'` returns app-code hits) — that means a UI depends on public access and the fix needs an authenticated wrapper instead.
- The code at the cited lines doesn't match the excerpts (drift).
- Tests fail in a way unrelated to your change after one fix attempt.

## Maintenance notes

- Any future seed/demo-data function must be registered with `internalAction`/`internalMutation`, never `action`/`mutation`. Reviewers should reject public registration of anything destructive.
- If a "reset demo data" button is ever wanted in the product UI, build an authenticated, org-scoped mutation — do not re-publicize these functions.
