# Plan 019: Replace remaining placeholder backend tests and add a guard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8a341d62..HEAD -- packages/backend/tests package.json .github/workflows/check.yml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `8a341d62`, 2026-06-19

## Why this matters

Plan 007 replaced two placeholder test files, but more assertion-free tests
remain. They inflate backend test counts while proving nothing about transit,
library, media, installations, and other critical workflows. Replacing or
deleting them makes CI signal honest and prevents placeholders from returning.

## Current state

- `packages/backend/tests/library.test.ts` contains commented intended tests and
  `expect(true).toBe(true)`.

```text
library.test.ts:7 test("should create library item and copy with barcode", async () => {
library.test.ts:26 expect(true).toBe(true);
```

- `packages/backend/tests/transit.test.ts` has the same pattern.

```text
transit.test.ts:8 test("should create transit record with auto-generated number", async () => {
transit.test.ts:24 expect(true).toBe(true);
```

- `packages/backend/tests/installations.test.ts` has commented assertions and a
  true assertion.

```text
installations.test.ts:7 test("should create installation task linked to exhibition", async () => {
installations.test.ts:26 expect(true).toBe(true);
```

Use real tests such as `packages/backend/tests/libraryHolds.test.ts`,
`packages/backend/tests/apiKeys.test.ts`, and `packages/backend/tests/loans.test.ts`
as harness examples.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Find placeholders | `rg -n "expect\\(true\\)\\.toBe\\(true\\)|expect\\(true\\)" packages/backend/tests` | no matches when done |
| Target tests | `cd packages/backend && bunx vitest run library transit installations media` | pass for matching tests |
| Backend tests | `cd packages/backend && bun run test:once` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/tests/*.test.ts`
- Optional test guard script in `package.json` or CI workflow

**Out of scope**:
- Production code changes to make tests pass.
- Rewriting entire modules.
- Frontend test coverage; plan 020 covers CI/app test routing.

## Git workflow

- Branch: `advisor/019-remove-placeholder-tests`
- Commit message example: `test(backend): replace remaining placeholder tests`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Inventory placeholders

Run the placeholder grep command and list every file containing
`expect(true)`-style assertions. Classify each test as:

- duplicate of existing real coverage -> delete the placeholder test;
- important workflow -> replace with a real convex-test characterization test;
- blocked by untestable production design -> convert to `test.skip` with a
  specific reason only if deletion would hide a known gap.

**Verify**: local inventory covers every grep match.

### Step 2: Replace the highest-risk placeholders

Prioritize tests in this order:

1. Transit create/status/history.
2. Library catalog/copy flow not already covered by `libraryHolds.test.ts`.
3. Installations task workflow.
4. Media placeholders that are not already covered by real media security tests.

Use existing fixture helpers from `packages/backend/tests/testHarness.ts` and
`testSetup.ts`. Do not use fake IDs cast to Convex IDs.

**Verify**: `cd packages/backend && bunx vitest run library transit installations media` -> pass for matching files.

### Step 3: Add a guard against new placeholders

Add a minimal CI-safe guard. Preferred option: a package script such as
`test:no-placeholders` using `rg -n "expect\\(true\\)\\.toBe\\(true\\)|expect\\(true\\)" packages/backend/tests`
and wire it into CI or the root test command. The command should fail if matches
exist.

Do not add a large custom test framework.

**Verify**: run the guard command -> exit 0.

### Step 4: Full verification

Run:

```bash
bun run typecheck
bun run lint
cd packages/backend && bun run test:once
```

All commands must exit 0.

## Test plan

The deliverable is real tests. Each remaining test must assert behavior: returned
IDs, persisted fields, state transitions, or expected errors. No placeholder true
assertions may remain.

## Done criteria

- [ ] Placeholder grep returns no matches in backend tests.
- [ ] High-risk placeholders are replaced or deleted with intent.
- [ ] A guard prevents reintroducing assertion-free placeholders.
- [ ] Backend tests, lint, and typecheck pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- A meaningful test requires production-code changes outside this plan.
- The placeholder inventory is much larger than expected; report the count and
  propose splitting.
- A cited excerpt no longer matches live code.

## Maintenance notes

Test count going down is acceptable if false tests are deleted. The goal is
truthful verification, not a larger number.
