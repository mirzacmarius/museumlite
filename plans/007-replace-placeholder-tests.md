# Plan 007: Replace assertion-free placeholder tests with real coverage (or remove them)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12620298..HEAD -- packages/backend/tests/integrations.test.ts packages/backend/tests/conservation.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `12620298`, 2026-06-12

## Why this matters

At least two backend test files contain tests that assert nothing — they instantiate `convexTest` and then `expect(true).toBe(true)`. These pass in CI and inflate the test count, creating **false confidence**: the integrations file claims to cover API-key creation, webhook registration, webhook delivery, and key validation; the conservation file claims to cover the treatment workflow. None of it is actually exercised. Either make them real or delete them — a green check that proves nothing is worse than an honest gap.

## Current state

### 7a. `packages/backend/tests/integrations.test.ts` (full file, 36 lines)

```typescript
test("should create API key for organization", async () => {
  const _t = convexTest(schema, modules);
  expect(true).toBe(true);
});
// ...5 more identical placeholders: revoke API key, register webhook endpoint,
// update webhook event subscriptions, validate API key on request, deliver webhook events
```

Note: real API-key coverage **already exists** in `packages/backend/tests/apiKeys.test.ts` (exercises `api.apiKeys.create`, `list`, `revoke`, `validate`). So the API-key placeholders here are pure duplication; the genuinely uncovered surface is **webhooks** (`packages/backend/convex/webhooks.ts`, `webhooksActions.ts`).

### 7b. `packages/backend/tests/conservation.test.ts`

Six tests with commented-out API calls and `expect(true).toBe(true)`, targeting `conservationTreatments.ts` (a large module wired into crons at `crons.ts:33-39`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests | `cd packages/backend && bun run test:once` | all pass |
| Run target tests | `cd packages/backend && bunx vitest run integrations conservation` | pass |
| Find test setup helpers | `rg -n "createOrganization\|setupOrg\|authed" packages/backend/tests/apiKeys.test.ts` | shows the pattern |

## Suggested executor toolkit

- Use `packages/backend/tests/apiKeys.test.ts` as the structural template for convex-test org setup + authenticated calls. Read it before writing any test.

## Scope

**In scope**:
- `packages/backend/tests/integrations.test.ts`
- `packages/backend/tests/conservation.test.ts`

**Out of scope**:
- The backend modules under test — do not change `webhooks.ts`, `conservationTreatments.ts`, etc. to make testing easier in this plan. (If a module is untestable without a change, STOP and report.)
- `packages/backend/tests/apiKeys.test.ts` — already real; leave it.
- Note: if plan 002 (authorize public endpoints) lands first, `apiKeys.validate` / `webhooksActions.test` may be internal — call them via `internal.*` accordingly.

## Git workflow

- Branch: `advisor/007-real-tests`
- Conventional commits, e.g. `test(backend): replace placeholder integration tests with real webhook coverage`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Read the working template

Read `packages/backend/tests/apiKeys.test.ts` fully. Note how it creates an org, gets an authed client, and calls `api.*`. Identify the shared setup in `packages/backend/tests/testSetup.ts` (already imported as `modules`).

### Step 2: Rewrite `integrations.test.ts` for webhooks

- Delete the two API-key placeholder tests (covered by `apiKeys.test.ts`).
- Replace the four webhook placeholders with real tests against the webhook API. Find the function names: `rg -n "export const" packages/backend/convex/webhooks.ts packages/backend/convex/webhooksActions.ts`. Likely: create/register a webhook, list it, update its subscribed events, revoke/delete it. Assert on returned IDs and on the stored document via a follow-up query.
- For webhook **delivery** (`webhooksActions.test`, which does an outbound `fetch`): do not hit the network in tests. Either (a) assert it throws for an unauthenticated/invalid webhook (works without network), or (b) skip delivery with a clear `test.skip("delivery requires network", ...)` and a comment. Do not write a test that depends on a real external endpoint.

**Verify**: `cd packages/backend && bunx vitest run integrations` → pass with real assertions (no `expect(true).toBe(true)` remains: `rg -n "expect\(true\)" packages/backend/tests/integrations.test.ts` → no matches).

### Step 3: Rewrite or remove `conservation.test.ts`

- Inspect `conservationTreatments.ts` exports (`rg -n "export const" packages/backend/convex/conservationTreatments.ts`). Write characterization tests for the core lifecycle you can reach: create a treatment, transition/approve/complete it, and assert state. Use the org-setup pattern from Step 1.
- If a meaningful test cannot be written for some placeholder (e.g. cron-driven alerts need scheduler simulation beyond the harness), delete that placeholder rather than leaving `expect(true)`. Keep only tests that assert real behavior.

**Verify**: `rg -n "expect\(true\)" packages/backend/tests/conservation.test.ts` → no matches; `cd packages/backend && bunx vitest run conservation` → pass.

### Step 4: Full suite

**Verify**: `cd packages/backend && bun run test:once` → all pass.

## Test plan

The deliverable *is* tests. Quality bar: every remaining test makes at least one assertion about backend behavior (a returned ID, a stored field, a thrown error), not `expect(true)`. Net test count may go down — that is acceptable and expected.

## Done criteria

- [ ] `rg -rn "expect\(true\)\.toBe\(true\)" packages/backend/tests/integrations.test.ts packages/backend/tests/conservation.test.ts` returns no matches
- [ ] `integrations.test.ts` contains real webhook CRUD assertions
- [ ] `conservation.test.ts` contains real treatment-lifecycle assertions (or fewer, real tests)
- [ ] `cd packages/backend && bun run test:once` exits 0
- [ ] No out-of-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- A target module genuinely cannot be tested without modifying production code (report what change would be needed).
- The webhook functions require Node-runtime/network in a way the convex-test harness cannot simulate — then convert those specific cases to `test.skip` with a reason rather than faking them.
- A cited excerpt doesn't match the live code (drift).

## Maintenance notes

- A grep guard would prevent regressions: consider adding `expect(true).toBe(true)` to a lint/CI deny-list in a follow-up so placeholder tests can't reappear.
- Audit the rest of `packages/backend/tests/` for the same `expect(true)` pattern (`rg -rn "expect\(true\)\.toBe\(true\)" packages/backend/tests`) — there may be more placeholder files beyond these two; list them for a follow-up if found.
