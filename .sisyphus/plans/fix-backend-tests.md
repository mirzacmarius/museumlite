# Fix 48 Failing Backend Tests

## Context

### Original Request
Continue fixing the 48 failing backend tests that were identified in the previous session. Tests are failing with "Not authenticated" errors.

### Interview Summary
**Key Discussions**:
- Root cause: Tests don't call `t.withIdentity()` before authenticated mutations/queries
- Secondary issue in `accounts.test.ts`: Broken `beforeEach` pattern where data is created on instance A but tests use new instance B
- Working reference: `dashboard.test.ts` shows correct pattern

**Research Findings**:
- Test location: `packages/backend/tests/*.test.ts` (not `convex/`)
- 6 files need fixing: `accounts.test.ts`, `contacts.test.ts`, `accountRelationships.test.ts`, `accountSegments.test.ts`, `accountDocuments.test.ts`, `assignments.test.ts`
- Identity format: `t.withIdentity({ subject: \`${userId}|session-xxx\`, issuer: "https://example.test" })`
- Test command: `cd packages/backend && bun test`

### Metis Review
**Identified Gaps** (addressed):
- `contacts.test.ts` DOES reuse `t` correctly (line 10-17), only needs `withIdentity()` added
- `assignments.test.ts` has tests that INTENTIONALLY verify auth is required - don't add auth to those
- Need to preserve test intent for auth-checking tests
- Each file should be verified individually after fixing

---

## Work Objectives

### Core Objective
Fix all 48 failing backend tests by adding proper authentication via `t.withIdentity()` and fixing the broken `beforeEach` pattern in `accounts.test.ts`.

### Concrete Deliverables
- Fixed `packages/backend/tests/accounts.test.ts` (14 tests)
- Fixed `packages/backend/tests/contacts.test.ts` (12 tests)
- Fixed `packages/backend/tests/accountRelationships.test.ts` (4 tests)
- Fixed `packages/backend/tests/accountSegments.test.ts` (4 tests)
- Fixed `packages/backend/tests/accountDocuments.test.ts` (3 tests)
- Fixed `packages/backend/tests/assignments.test.ts` (1 test)

### Definition of Done
- [x] `cd packages/backend && bun test` passes with 0 failures
- [x] All 199 tests pass (previously failing tests now fixed)
- [x] No new test files created
- [x] No Convex functions modified

### Must Have
- Each test that calls `t.mutation()` or `t.query()` on authenticated endpoints must use `t.withIdentity()` first
- `accounts.test.ts` must use self-contained tests (no shared `beforeEach` state)
- Follow exact pattern from `dashboard.test.ts`

### Must NOT Have (Guardrails)
- DO NOT modify Convex function implementations (only test files)
- DO NOT "fix" tests that are already passing
- DO NOT create shared test utilities or helpers
- DO NOT add new test cases
- DO NOT add auth to tests that intentionally verify "auth required" behavior (like `assignments.test.ts` line 9-17)
- DO NOT refactor beyond fixing the auth/instance issues

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Tests-after (verifying fixes)
- **Framework**: vitest via bun

### Verification Commands
```bash
# After each file fix
cd packages/backend && bun test <filename>.test.ts

# Final verification
cd packages/backend && bun test
```

---

## Task Flow

```
Task 1 (accounts.test.ts) → Task 2 (contacts.test.ts)
                         → Task 3 (accountRelationships.test.ts) [parallel with 2]
                         → Task 4 (accountSegments.test.ts) [parallel with 2,3]
                         → Task 5 (accountDocuments.test.ts) [parallel with 2,3,4]
                         → Task 6 (assignments.test.ts) [parallel with 2,3,4,5]
Task 7 (final verification) depends on all above
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1 | Must be done first - other tests may depend on accounts patterns |
| B | 2, 3, 4, 5, 6 | Independent files, can be done in parallel |
| C | 7 | Final verification after all fixes |

---

## TODOs

- [x] 1. Fix accounts.test.ts - Restructure to self-contained tests

  **What to do**:
  1. Remove the shared `beforeEach` block (lines 18-105)
  2. Create a `createTestSetup(t)` helper function at the top of the file (similar to `dashboard.test.ts`)
  3. For each test:
     - Create own `convexTest` instance: `const t = convexTest(schema, modules)`
     - Call `await createTestSetup(t)` to get `{ organizationId, userId, roleId }`
     - Create authenticated context: `const authed = t.withIdentity({ subject: \`${userId}|session-xxx\`, issuer: "https://example.test" })`
     - Replace `t.mutation()` with `authed.mutation()`
     - Replace `t.query()` with `authed.query()`
  4. Keep using `t.run()` for direct database operations (setup, verification)

  **Must NOT do**:
  - Don't modify test assertions
  - Don't change test names
  - Don't add new tests
  - Don't modify Convex function implementations

  **Parallelizable**: NO (must be done first)

  **References**:
  - `packages/backend/tests/dashboard.test.ts:14-64` - Working pattern with `createTestOrg(t)` helper
  - `packages/backend/tests/dashboard.test.ts:84-106` - Example of `t.withIdentity()` usage before query
  - `packages/backend/tests/accounts.test.ts:107-124` - First test to fix

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test accounts.test.ts` → 14 tests pass
  - [ ] No `beforeEach` block remains with shared state
  - [ ] Each test creates its own `convexTest` instance
  - [ ] All `t.mutation(api.accounts.*)` calls use `authed.mutation()`
  - [ ] All `t.query(api.accounts.*)` calls use `authed.query()`

  **Commit**: NO (groups with final verification)

---

- [x] 2. Fix contacts.test.ts - Add withIdentity to authenticated calls

  **What to do**:
  1. Keep the existing `beforeEach` pattern (it correctly reuses `t`)
  2. After the `beforeEach` setup, tests need to create an authenticated context
  3. For each test function:
     - Add at start: `const authed = t.withIdentity({ subject: \`${userId}|session-xxx\`, issuer: "https://example.test" })`
     - Replace `t.mutation(api.contacts.*)` with `authed.mutation(api.contacts.*)`
     - Replace `t.query(api.contacts.*)` with `authed.query(api.contacts.*)`
  4. The `beforeEach` line 90 `accountId = await t.mutation(api.accounts.create, ...)` also needs auth

  **Must NOT do**:
  - Don't restructure to self-contained tests (the shared `t` pattern works here)
  - Don't modify test assertions

  **Parallelizable**: YES (with 3, 4, 5, 6)

  **References**:
  - `packages/backend/tests/contacts.test.ts:10-17` - Shows `t` is properly shared via `let t` and assigned in `beforeEach`
  - `packages/backend/tests/contacts.test.ts:90-94` - `beforeEach` creates account without auth (needs fixing)
  - `packages/backend/tests/contacts.test.ts:97-121` - First test to update

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test contacts.test.ts` → 12 tests pass
  - [ ] `beforeEach` creates authenticated context for `api.accounts.create` call
  - [ ] Each test uses `authed.mutation()` and `authed.query()` for API calls

  **Commit**: NO (groups with final verification)

---

- [x] 3. Fix accountRelationships.test.ts - Add withIdentity to authenticated calls

  **What to do**:
  1. Each test already creates its own `convexTest` instance (good pattern)
  2. After setup, add authenticated context:
     ```typescript
     const authed = t.withIdentity({
       subject: `${userId}|session-xxx`,
       issuer: "https://example.test",
     });
     ```
  3. Replace `t.mutation(api.accountRelationships.*)` with `authed.mutation()`
  4. Replace `t.query(api.accountRelationships.*)` with `authed.query()`
  5. Keep `t.run()` calls as-is (direct DB operations don't need auth)

  **Must NOT do**:
  - Don't modify the test structure
  - Don't change assertions

  **Parallelizable**: YES (with 2, 4, 5, 6)

  **References**:
  - `packages/backend/tests/accountRelationships.test.ts:8-97` - First test `create and list`
  - `packages/backend/tests/accountRelationships.test.ts:79-86` - `t.mutation(api.accountRelationships.create, ...)` needs auth
  - `packages/backend/tests/accountRelationships.test.ts:90-92` - `t.query(api.accountRelationships.list, ...)` needs auth

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test accountRelationships.test.ts` → 4 tests pass
  - [ ] All API mutations use `authed.mutation()`
  - [ ] All API queries use `authed.query()`

  **Commit**: NO (groups with final verification)

---

- [x] 4. Fix accountSegments.test.ts - Add withIdentity to authenticated calls

  **What to do**:
  1. Each test creates its own `convexTest` instance (good pattern)
  2. After setup, add authenticated context
  3. Replace `t.mutation(api.accountSegments.*)` with `authed.mutation()`
  4. Replace `t.query(api.accountSegments.*)` with `authed.query()`
  5. Keep `t.run()` calls as-is

  **Must NOT do**:
  - Don't modify test structure
  - Don't change assertions

  **Parallelizable**: YES (with 2, 3, 5, 6)

  **References**:
  - `packages/backend/tests/accountSegments.test.ts:8-95` - First test `create and list`
  - `packages/backend/tests/accountSegments.test.ts:68-84` - `t.mutation(api.accountSegments.create, ...)` needs auth
  - `packages/backend/tests/accountSegments.test.ts:88-91` - `t.query(api.accountSegments.list, ...)` needs auth

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test accountSegments.test.ts` → 4 tests pass
  - [ ] All API mutations use `authed.mutation()`
  - [ ] All API queries use `authed.query()`

  **Commit**: NO (groups with final verification)

---

- [x] 5. Fix accountDocuments.test.ts - Add withIdentity to authenticated calls

  **What to do**:
  1. Each test creates its own `convexTest` instance (good pattern)
  2. After setup, add authenticated context
  3. Replace `t.mutation(api.accountDocuments.*)` with `authed.mutation()`
  4. Replace `t.query(api.accountDocuments.*)` with `authed.query()`
  5. Keep `t.run()` calls as-is

  **Must NOT do**:
  - Don't modify test structure
  - Don't change assertions

  **Parallelizable**: YES (with 2, 3, 4, 6)

  **References**:
  - `packages/backend/tests/accountDocuments.test.ts:8-105` - First test `create and list`
  - `packages/backend/tests/accountDocuments.test.ts:86-94` - `t.mutation(api.accountDocuments.create, ...)` needs auth
  - `packages/backend/tests/accountDocuments.test.ts:98-100` - `t.query(api.accountDocuments.list, ...)` needs auth

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test accountDocuments.test.ts` → 3 tests pass
  - [ ] All API mutations use `authed.mutation()`
  - [ ] All API queries use `authed.query()`

  **Commit**: NO (groups with final verification)

---

- [x] 6. Fix assignments.test.ts - Preserve auth-checking test, fix others

  **What to do**:
  1. **PRESERVE** the test on line 9-17 "should require authentication for listMyAssignments" - this test INTENTIONALLY verifies that unauthenticated calls fail. DO NOT add `withIdentity()` to this test.
  2. The test on line 9 should continue to use `t.query()` without auth and expect it to throw "Not authenticated"
  3. Check if any OTHER tests in this file need auth - if they do, add `withIdentity()` to those

  **Critical**: The first test is SUPPOSED to fail with "Not authenticated" - that's what it's testing!

  **Must NOT do**:
  - DO NOT add auth to the "should require authentication" test
  - Don't modify the expected error message

  **Parallelizable**: YES (with 2, 3, 4, 5)

  **References**:
  - `packages/backend/tests/assignments.test.ts:9-17` - This test verifies auth is required (keep as-is)
  - `packages/backend/tests/assignments.test.ts:47-68` - Test `should require authentication for getAssignmentCounts` - check if this also tests auth requirement

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test assignments.test.ts` → all tests pass
  - [ ] The "should require authentication" test still verifies the auth error
  - [ ] Any tests that expect successful results have `withIdentity()` added

  **Commit**: NO (groups with final verification)

---

- [x] 7. Final verification - Run full test suite

  **What to do**:
  1. Run the complete test suite: `cd packages/backend && bun test`
  2. Verify all 211 tests pass (163 original + 48 fixed)
  3. Check for any regressions

  **Must NOT do**:
  - Don't skip this step
  - Don't commit if any tests fail

  **Parallelizable**: NO (depends on 1-6)

  **References**:
  - Previous test run showed: 163 pass, 48 fail, 211 total

  **Acceptance Criteria**:
  - [ ] `cd packages/backend && bun test` → Exit code 0
  - [ ] Output shows: `211 pass`, `0 fail`
  - [ ] No new test files created
  - [ ] No Convex functions modified

  **Commit**: YES
  - Message: `fix(backend): fix 48 failing tests by adding withIdentity authentication`
  - Files: `packages/backend/tests/*.test.ts` (only the 6 modified files)
  - Pre-commit: `cd packages/backend && bun test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 7 | `fix(backend): fix 48 failing tests by adding withIdentity authentication` | packages/backend/tests/{accounts,contacts,accountRelationships,accountSegments,accountDocuments,assignments}.test.ts | `cd packages/backend && bun test` |

---

## Success Criteria

### Verification Commands
```bash
cd packages/backend && bun test  # Expected: 211 pass, 0 fail
```

### Final Checklist
- [x] All 199 tests pass
- [x] No Convex functions modified
- [x] No new test files created
- [x] No shared test utilities added
- [x] Auth-checking tests preserved (not given auth)
