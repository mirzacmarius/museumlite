# Plan 046: Extend placeholder guard to convex test files

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. SKIP updating `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f3383f6e..HEAD -- packages/backend/package.json packages/backend/vitest.config.ts`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f3383f6e`, 2026-06-29

## Why this matters

`test:no-placeholders` only scans `tests/` but vitest also runs `convex/**/*.test.ts` (`vitest.config.ts:8`). Placeholders could land in convex co-located tests and pass CI.

## Current state

```text
packages/backend/package.json:11 — rg scoped to "tests" directory only
packages/backend/vitest.config.ts — includes convex/**/*.test.ts
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Guard | `cd packages/backend && bun run test:no-placeholders` | exit 0 |
| Full test | `cd packages/backend && bun run test` | all pass |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**: `packages/backend/package.json` — `test:no-placeholders` script only

**Out of scope**: Fixing any placeholders found (should be none)

## Git workflow

- Branch: `advisor/046-extend-placeholder-guard-scope`
- Commit message: `chore(test): scan convex co-located tests for placeholders`
- Do not push unless instructed.

## Steps

### Step 1: Expand rg paths

Change guard to scan both `tests` and `convex` directories under `packages/backend`, e.g.:

```json
"test:no-placeholders": "sh -c 'rg -n \"expect\\\\(true\\\\)\\\\.toBe\\\\(true\\\\)|expect\\\\(true\\\\)\" tests convex && exit 1 || exit 0'"
```

Adjust rg invocation if needed so both dirs are scanned (single rg with two paths).

### Step 2: Verify

Run `bun run test:no-placeholders` then `bun run test`.

## Done criteria

- [ ] Guard covers `packages/backend/convex/**/*.test.ts`
- [ ] `bun run test` passes
- [ ] Only package.json changed

## STOP conditions

- Guard finds existing placeholders — fix them in same PR if trivial (≤2 files); else STOP and report count

## Maintenance notes

If vitest include paths change, update guard paths to match.
