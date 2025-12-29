# Testing Strategy Proposal

## Philosophy (Per Project Standards)

- ✅ **Minimal tests during development** - Focus on feature completion first
- ✅ **Test only core user flows** - Critical paths and primary workflows
- ✅ **Fast execution** - Run tests frequently during development
- ✅ **Test behavior, not implementation** - What it does, not how

## Proposed Setup

### 1. Backend Tests (Convex Mutations/Queries)

**Tool:** `convex-test` + Vitest (Official Convex Testing Library)
**Location:** `packages/backend/convex/*.test.ts` (in convex directory)

**Why `convex-test`?**

- Official Convex testing library (recommended by Convex docs)
- Fast execution (runs in Edge Runtime via Vitest)
- Great TypeScript support
- Simple setup with `convexTest(schema)` helper
- Direct testing of mutations/queries without mocking

**What to Test:**

- Critical loan workflow mutations (approve, dispatch, return, cancel)
- Status transitions work correctly
- Permissions enforced
- Error handling for invalid states

### 2. Frontend Component Tests (Optional - Later)

**Tool:** Vitest + React Testing Library
**Location:** `apps/app/src/__tests__/`

**What to Test:**

- LoanApprovalWorkflow component renders correct buttons per status
- Form validation works
- User interactions trigger correct mutations

### 3. E2E Tests (Critical Workflows Only)

**Tool:** Playwright (if needed later)
**Location:** `e2e/`

**What to Test:**

- Complete loan lifecycle: create → approve → dispatch → return
- Only for most critical user journeys

## Implementation Plan

### Phase 1: Backend Tests (Start Here)

1. Install dependencies: `convex-test`, `vitest`, `@edge-runtime/vm`
2. Create `vitest.config.ts` with Edge Runtime environment
3. Write tests in `convex/*.test.ts` files using `convexTest(schema)`
4. Run with: `bun test` (from backend package)

### Phase 2: Frontend Tests (If Needed)

1. Set up Vitest + React Testing Library in `apps/app`
2. Test critical components (LoanApprovalWorkflow)
3. Mock Convex hooks

### Phase 3: E2E Tests (Future)

1. Set up Playwright
2. Test complete loan workflow end-to-end
3. Run before major releases

## Recommended: Start with Backend Tests Only

**Why?**

- Backend logic is the most critical (business rules, permissions)
- Faster to write and run
- Catches most bugs early
- Frontend tests can be added later if needed

## Test File Structure

```
packages/backend/convex/
  ├── loans.test.ts          # Loan workflow mutations (using convex-test)
  ├── loans.ts               # Actual implementation
  └── schema.ts              # Schema for convexTest()

apps/app/src/__tests__/       # (Future)
  └── components/
      └── loan-approval-workflow.test.tsx
```

## Running Tests

```bash
# Backend tests
cd packages/backend
bun test

# All tests (from root)
bun test

# Watch mode (during development)
bun test --watch
```

## Example Test (Loans Workflow)

```typescript
// packages/backend/convex/loans.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("should approve pending loan and change status to active", async () => {
  const t = convexTest(schema);
  
  // Create a pending loan
  const loanId = await t.mutation(api.loans.create, {
    organizationId: "test-org-id",
    borrowerId: "test-borrower-id",
    // ... other required fields
  });
  
  // Verify initial status
  const initialLoan = await t.query(api.loans.get, { loanId });
  expect(initialLoan?.status).toBe("pending");
  
  // Approve the loan
  await t.mutation(api.loans.approve, { loanId });
  
  // Verify status changed
  const approvedLoan = await t.query(api.loans.get, { loanId });
  expect(approvedLoan?.status).toBe("active");
});

test("should dispatch active loan", async () => {
  const t = convexTest(schema);
  // ... test dispatch mutation
});

test("should return dispatched loan", async () => {
  const t = convexTest(schema);
  // ... test return from dispatched state
});
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd packages/backend
bun add -d convex-test vitest @edge-runtime/vm
```

### 2. Create Vitest Config

```typescript
// packages/backend/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

### 3. Add Test Scripts

Add to `packages/backend/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:once": "vitest run",
    "test:watch": "vitest --watch"
  }
}
```

## CI Integration (Simple)

Add to root `package.json`:

```json
{
  "scripts": {
    "test": "turbo test",
    "test:backend": "cd packages/backend && bun test"
  }
}
```

Add to `.github/workflows/test.yml` (if using GitHub):

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
```

## Recommendation

**Start with:**

1. ✅ Backend tests for loan workflow mutations
2. ✅ Manual testing checklist (already created)
3. ⏸️ Frontend/E2E tests can wait until needed

**Benefits:**

- Fast feedback on critical business logic
- Easy to maintain
- Catches most bugs
- Can expand later if needed
