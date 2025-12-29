# Quick Setup: Convex Tests with convex-test

Based on [Convex Testing Documentation](https://docs.convex.dev/testing/convex-test)

## Step 1: Install Dependencies

```bash
cd packages/backend
bun add -d convex-test vitest @edge-runtime/vm
```

## Step 2: Create Vitest Config

Create `packages/backend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
```

## Step 3: Add Test Scripts

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

## Step 4: Create Test File

Create `packages/backend/convex/loans.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("should approve pending loan", async () => {
  const t = convexTest(schema);
  
  // Create loan
  const loanId = await t.mutation(api.loans.create, {
    // ... required fields
  });
  
  // Approve
  await t.mutation(api.loans.approve, { loanId });
  
  // Verify
  const loan = await t.query(api.loans.get, { loanId });
  expect(loan?.status).toBe("active");
});
```

## Step 5: Run Tests

```bash
# From packages/backend
bun test

# Watch mode
bun test:watch

# Run once
bun test:once
```

## Notes

- Tests go in `convex/` directory with `.test.ts` extension
- Use `convexTest(schema)` to create test helper
- Use `t.mutation()` and `t.query()` to test functions
- Each test gets a fresh database state

## Reference

- [Convex Testing Docs](https://docs.convex.dev/testing/convex-test)
- Example file: `packages/backend/convex/__tests__/loans-workflow.example.test.ts`
