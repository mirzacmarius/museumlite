# Plan 032: Use constant-time API key compare and unbiased key generation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat f8648557..HEAD -- packages/backend/convex/apiKeys.ts packages/backend/tests/apiKeys.test.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f8648557`, 2026-06-29

## Why this matters

API keys authenticate the public HTTP read API. Key generation still uses modulo-biased randomness (the pattern fixed in plan 021 for webhook secrets), and hash comparison uses `===`, which is not constant-time.

## Current state

- `packages/backend/convex/apiKeys.ts:7-19` — `generateApiKey()` uses `randomValue % chars.length`.
- `packages/backend/convex/apiKeys.ts:237` — `keys.find((k) => k.keyHash === keyHash)`.
- Exemplar for unbiased generation: `packages/backend/convex/webhooks.ts:27-46` (`generateSecret()` with rejection sampling).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Targeted tests | `cd packages/backend && bun test apiKeys.test.ts` | all pass |
| Full backend tests | `cd packages/backend && bun test` | all pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/apiKeys.ts`
- `packages/backend/tests/apiKeys.test.ts` (add/adjust tests only)

**Out of scope**:
- Rotating existing API keys in production
- HTTP rate limiting (separate finding)
- Changing key prefix/format (`ml_` + length)

## Git workflow

- Branch: `advisor/032-secure-api-key-generation-and-compare`
- Commit message: `fix(apiKeys): use unbiased randomness and constant-time hash compare`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Replace biased key generation

Refactor `generateApiKey()` to use the same rejection-sampling loop as `webhooks.ts:27-46`. Keep prefix `ml_` and total body length (37 chars after prefix per current implementation).

**Verify**: `grep -n "randomValue % chars" packages/backend/convex/apiKeys.ts` returns no matches.

### Step 2: Constant-time hash comparison

Add a helper (in `apiKeys.ts` or a small util) that compares two hex SHA-256 digests with `crypto.subtle.timingSafeEqual` on equal-length buffers. Use it in `validate` instead of `===`. If no match, return `{ valid: false }` without early string compare leaks.

**Verify**: `grep -n "keyHash ===" packages/backend/convex/apiKeys.ts` returns no matches.

### Step 3: Add regression tests

In `packages/backend/tests/apiKeys.test.ts`:
- Assert generated keys match `^ml_[A-Za-z0-9]{37}$` (adjust if length differs).
- Assert validate accepts a created key and rejects a wrong key with same prefix.

**Verify**: `cd packages/backend && bun test apiKeys.test.ts` — all pass.

### Step 4: Full gates

Run `bun run typecheck`, `bun run lint`, and `cd packages/backend && bun test`.

## Done criteria

- [ ] No modulo-biased randomness in `generateApiKey`
- [ ] Hash compare uses constant-time helper
- [ ] apiKeys tests pass; full backend test suite passes
- [ ] typecheck + lint pass
- [ ] Only in-scope files changed

## STOP conditions

- Cited lines no longer match live code
- `timingSafeEqual` unavailable in Convex runtime (report — use documented fallback)
- Tests require touching out-of-scope files

## Maintenance notes

If key format changes, update tests and any HTTP integration tests in `apiKeys.test.ts` that assert prefix/length.
