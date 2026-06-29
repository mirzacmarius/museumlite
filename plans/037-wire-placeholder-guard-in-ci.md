# Plan 037: Run placeholder-test guard in CI backend test script

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- packages/backend/package.json .github/workflows/check.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

Plan 019 added `test:no-placeholders` but only wired it into `test:once`. CI and root `bun run test` invoke `packages/backend` `test` (`vitest run`) directly, so placeholder tests can slip through CI.

## Current state

```text
packages/backend/package.json:10-12 — "test": "vitest run"; "test:once": "bun run test:no-placeholders && vitest run"
.github/workflows/check.yml:54-55 — run: bun run test (turbo → backend test without guard)
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Guard alone | `cd packages/backend && bun run test:no-placeholders` | exit 0 on clean tree |
| Backend tests | `cd packages/backend && bun test` | all pass |
| Root tests | `bun run test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/package.json` — prepend guard to `test` script

**Out of scope**:
- Rewriting placeholder tests (already done in 019)
- Changing turbo test graph beyond what `test` script change implies
- `test:watch` (keep without guard for dev ergonomics)

## Git workflow

- Branch: `advisor/037-wire-placeholder-guard-in-ci`
- Commit message: `chore(test): run placeholder guard before backend vitest`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Update test script

Change:

```json
"test": "vitest run",
```

to:

```json
"test": "bun run test:no-placeholders && vitest run",
```

Keep `test:once` as alias (duplicate is OK) or dedupe to call `test` — minimal change preferred.

**Verify**: `cd packages/backend && bun test` runs guard first (observe guard command in output).

### Step 2: Verify guard catches placeholders

Temporarily add `expect(true).toBe(true)` to a test file, run `bun run test:no-placeholders` — must exit non-zero. Revert before commit.

**Verify**: reverted; no placeholder left in commit.

### Step 3: Full gates

Run `bun run test`, typecheck, lint.

## Done criteria

- [ ] `packages/backend` `test` script runs `test:no-placeholders` before vitest
- [ ] `bun run test` at repo root passes
- [ ] typecheck + lint pass
- [ ] Only in-scope files changed

## STOP conditions

- Guard false-positive on legitimate `expect(true)` in non-test code — adjust rg pattern minimally and document

## Maintenance notes

If new test directories added outside `packages/backend/tests`, extend `test:no-placeholders` rg path in same file.
