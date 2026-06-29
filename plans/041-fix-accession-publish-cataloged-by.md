# Plan 041: Remove arbitrary user fallback on accession publish

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat acb6dfa4..HEAD -- packages/backend/convex/accessions.ts packages/backend/tests/accessions.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `acb6dfa4`, 2026-06-29

## Why this matters

When publishing an accession, `catalogedBy` falls back to `ctx.db.query("users").first()` if `approvedBy` is missing — attributing cataloging to an arbitrary user.

## Current state

`packages/backend/convex/accessions.ts:1943-1947`:
```typescript
const firstUser = await ctx.db.query("users").first();
catalogedBy = accession.approvedBy ?? firstUser?._id;
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Accessions tests | `cd packages/backend && bun run test accessions.test.ts` | all pass |
| Grep | `rg -n "users\\)\\.first\\(\\)" packages/backend/convex/accessions.ts` | no matches |
| Typecheck / lint | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**: `packages/backend/convex/accessions.ts` publish path; accession tests.

**Out of scope**: COR-13 publish idempotency; full accession workflow redesign.

## Git workflow

- Branch: `advisor/041-fix-accession-publish-cataloged-by`
- Commit message: `fix(accessions): require approvedBy for catalogedBy on publish`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Fail closed

If `accession.approvedBy` is missing at publish time, throw a clear error (e.g. `"Accession must be approved before publish"`) instead of querying `users.first()`.

Use `catalogedBy: accession.approvedBy` (non-optional after guard).

**Verify**: grep shows no `users.first()` in publish handler.

### Step 2: Tests

Add test: publish without `approvedBy` fails; publish with `approvedBy` sets `catalogedBy` correctly.

**Verify**: accessions tests pass.

### Step 3: Full gates

Run typecheck, lint, full backend tests.

## Done criteria

- [ ] No unscoped `users.first()` for catalogedBy
- [ ] Tests cover fail + success paths
- [ ] CI gates pass

## STOP conditions

- Publish path moved to different module — locate equivalent lines and report

## Maintenance notes

Align with plan 035 pattern (explicit actor user IDs, never global user scan).
