# Plan 044: Trim getBySlug to public-safe projection

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. SKIP updating `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3383f6e..HEAD -- packages/backend/convex/organizations.ts packages/backend/tests/getBySlug.test.ts apps/web/src`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (merge after 043 if both touch organizations.ts)
- **Category**: security
- **Planned at**: commit `f3383f6e`, 2026-06-29

## Why this matters

`getBySlug` returns full `settings`, `subscriptionTier`, and org hierarchy fields to unauthenticated callers. Public portal only needs name, slug, logo, type, and portal-related settings.

## Current state

```text
packages/backend/convex/organizations.ts:524-548 — returns settings (full object), subscriptionTier, parentOrganizationId, rootOrganizationId
```

Public consumers (`apps/web/src/app/[orgSlug]/[portalSlug]/portal-chrome.tsx`) use: `name`, `logoUrl`, `type`, `slug`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| getBySlug tests | `cd packages/backend && bun run test getBySlug.test.ts` | all pass |
| Full backend | `cd packages/backend && bun run test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/organizations.ts` — `getBySlug` returns validator + handler
- `packages/backend/tests/getBySlug.test.ts`
- `apps/web` only if TypeScript breaks on slimmer return type (unlikely)

**Out of scope**: Authenticated full-org fetch (use `organizations.get`); plan 043 queries

## Git workflow

- Branch: `advisor/044-trim-getBySlug-public-projection`
- Commit message: `fix(organizations): return public-safe projection from getBySlug`
- Do not push unless instructed.

## Steps

### Step 1: Narrow returns validator

Return only: `_id`, `name`, `slug`, `logoUrl`, `type`, `_creationTime`, and `settings.portalSettings` (optional object with portal flags only) — **not** full settings, subscriptionTier, parent/root org IDs.

### Step 2: Update handler

Map org doc to public projection. Keep logo URL resolution.

**Verify**: `rg subscriptionTier packages/backend/convex/organizations.ts` inside getBySlug handler — no leak in return object.

### Step 3: Tests

Assert `getBySlug` response does **not** include `subscriptionTier`, `enabledIntegrations`, `watermarkSettings`, or `ownerUserId`. Assert portal fields still present when seeded.

### Step 4: Full gates

typecheck, lint, full backend tests.

## Done criteria

- [ ] Public projection excludes sensitive settings/tier/hierarchy
- [ ] Portal fields still available
- [ ] Tests assert omission of sensitive fields
- [ ] CI gates pass

## STOP conditions

- Public catalog queries depend on trimmed fields — identify and extend whitelist minimally

## Maintenance notes

Any new public portal field must be explicitly added to the projection allowlist.
