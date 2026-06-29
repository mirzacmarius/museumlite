# Plan 042: Test Polar billing webhook HTTP handler

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md` unless your reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat acb6dfa4..HEAD -- packages/backend/convex/http.ts packages/backend/convex/subscriptions.ts packages/backend/tests/apiKeys.test.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (TEST-06 billing event pipeline can follow)
- **Category**: tests
- **Planned at**: commit `acb6dfa4`, 2026-06-29

## Why this matters

`POST /polar/events` verifies signatures and updates subscription state but has zero HTTP-level tests. Regressions in verification or routing ship silently.

## Current state

- Handler: `packages/backend/convex/http.ts:51-120`
- Exemplar HTTP test pattern: `packages/backend/tests/apiKeys.test.ts:416-505` (`t.fetch`)
- No tests reference `/polar/events` or `applyBillingSubscriptionEvent` at HTTP boundary

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| New tests | `cd packages/backend && bun run test http-polar.test.ts` | all pass |
| Full backend | `cd packages/backend && bun run test` | all pass |
| Typecheck / lint | `bun run typecheck && bun run lint` | exit 0 |

## Scope

**In scope**:
- New `packages/backend/tests/http-polar.test.ts` (or extend existing http test file if present)

**Out of scope**: Live Polar API; full TEST-06 internal action table tests (optional add-on); changing webhook secret env requirements.

## Git workflow

- Branch: `advisor/042-test-polar-billing-webhook-http`
- Commit message: `test(http): cover Polar billing webhook signature and routing`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Read handler and env

Document required env vars (`POLAR_WEBHOOK_SECRET` or equivalent at `http.ts:68`). Stub in test setup.

### Step 2: Write tests using convex-test fetch

At minimum:
1. Invalid/missing signature → 403 (or handler's rejection status)
2. Valid signed fixture payload → success status and expected side effect (tier/subscription field updated or action invoked)

Use `standardwebhooks` or mirror signing approach from handler.

Model on `apiKeys.test.ts` `t.fetch` pattern.

**Verify**: new file runs green.

### Step 3: Full gates

Run full backend tests, typecheck, lint.

## Done criteria

- [ ] HTTP tests cover bad signature + happy path
- [ ] No network calls to Polar
- [ ] Full backend suite passes

## STOP conditions

- Handler requires Node-only APIs incompatible with convex-test — report and test via internal mutation fallback only

## Maintenance notes

Pair with plan for TEST-06 (`applyBillingSubscriptionEvent` unit tests) if HTTP tests mock too much.
