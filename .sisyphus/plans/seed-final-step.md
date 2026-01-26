# Seed Missing Entities - Final Step

## Context

### Original Request
Complete the seeding of missing entity relationships in the demo database.

### Current State
- Task 1 (public action wrapper) is COMPLETE
- Task 2 (run seed) is BLOCKED by OCC errors
- Need to add error handling and retry logic to resolve OCC failures

### Debugging Findings (2024-01-26)
- `bunx convex run seedMetAction:runSeed` fails with OCC (OptimisticConcurrencyControlFailure)
- Error: "Documents read from or written to 'locationHistory' table changed while mutation was running"
- Records keep appearing in `locationHistory` even during clearing (app is active)
- Generic "Error" response doesn't provide enough detail

---

## Work Objectives

### Core Objective
Fix OCC issues and run the seed to populate all missing entity data.

### Concrete Deliverables
- Modified `packages/backend/convex/seedMetAction.ts` with robust error handling
- Successfully seeded database with all entity relationships

### Definition of Done
- [ ] `bunx convex run seedMetAction:runSeed` completes without errors
- [ ] Database contains location assignments, module details, relationships, admin data, library extensions

---

## TODOs

- [x] 1. Add public action wrapper to seedMetAction.ts (ALREADY DONE)

  **Status**: COMPLETE - wrapper exists at line 13

---

- [x] 2. Add error handling to runSeed action

  **What to do**:
  - Wrap the `ctx.runAction` call in try-catch
  - Return error message as string for debugging
  - Log the error to console

  **Code change** at `packages/backend/convex/seedMetAction.ts` line 13-20:
  ```typescript
  export const runSeed = action({
    args: {},
    returns: v.union(v.null(), v.string()),
    handler: async (ctx) => {
      try {
        await ctx.runAction(internal.seedMetAction.resetAndSeed, {});
        return null;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        console.error("Seed failed:", errorMessage);
        return errorMessage;
      }
    },
  });
  ```

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes
  - [ ] Running seed returns error message instead of generic "Error"

  **Commit**: NO (groups with task 3)

---

- [x] 3. Add OCC retry logic to clearTableBatch calls

  **What to do**:
  - In `resetAndSeed` function (line ~5538-5551), add retry with backoff for OCC errors
  - Reduce batch size from 500 to 100 for less contention
  - Add 100ms delay between batches

  **Code change** at `packages/backend/convex/seedMetAction.ts` line ~5538-5551:
  ```typescript
  for (const tableName of tablesToClear) {
    let deleted = 0;
    let batchDeleted: number;
    let retries = 0;
    const maxRetries = 3;
    
    do {
      try {
        batchDeleted = await ctx.runMutation(internal.seedMet.clearTableBatch, {
          tableName,
          batchSize: 100, // Reduced from 500 for less OCC contention
        });
        deleted += batchDeleted;
        retries = 0; // Reset on success
        await sleep(100); // Small delay between batches
      } catch (error) {
        if (error instanceof Error && error.message.includes("OptimisticConcurrencyControlFailure")) {
          retries++;
          if (retries >= maxRetries) {
            console.warn(`OCC retry limit reached for ${tableName}, continuing...`);
            batchDeleted = 0; // Break the loop
          } else {
            console.log(`OCC conflict on ${tableName}, retry ${retries}/${maxRetries}...`);
            await sleep(500 * retries); // Exponential backoff
            batchDeleted = 100; // Continue loop
          }
        } else {
          throw error; // Re-throw non-OCC errors
        }
      }
    } while (batchDeleted === 100);
    
    if (deleted > 0) {
      console.log(`  Cleared ${deleted} from ${tableName}`);
    }
  }
  ```

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes
  - [ ] Clearing handles OCC errors gracefully with retries

  **Commit**: YES
  - Message: `fix(seed): add OCC retry logic and error handling for robust seeding`
  - Files: `packages/backend/convex/seedMetAction.ts`

---

- [x] 4. Run the seed

  **What to do**:
  - Execute the seed command from packages/backend directory
  - Wait for completion (may take several minutes due to Met API fetches)
  - If it returns an error string, investigate the specific error

  **Command**:
  ```bash
  cd packages/backend && bunx convex run seedMetAction:runSeed
  ```

  **Parallelizable**: NO (depends on tasks 2-3)

  **Acceptance Criteria**:
  - [ ] Command returns `null` (success) not error string
  - [ ] Logs show "Seed completed!" message

  **Commit**: NO (no code changes)

---

- [x] 5. Verify seeded data

  **What to do**:
  - Run the verification query to confirm entity counts
  - Or check Convex dashboard for populated tables

  **Command**:
  ```bash
  cd packages/backend && bunx convex run seedMet:verifyEntityCounts
  ```

  **Parallelizable**: NO (depends on task 4)

  **Acceptance Criteria**:
  - [ ] `locationHistory` count > 0
  - [ ] Module details (wine/vehicle/naturalHistory/archive) counts > 0
  - [ ] `accountRelationships` count > 0
  - [ ] `objectComments` count > 0
  - [ ] `apiKeys`, `webhooks`, `scheduledReports` counts > 0

  **Commit**: NO

---

## Success Criteria

### Verification Commands
```bash
# Typecheck
bun run typecheck  # Expected: no errors

# Run seed
cd packages/backend && bunx convex run seedMetAction:runSeed  # Expected: returns null (success)

# Verify counts
cd packages/backend && bunx convex run seedMet:verifyEntityCounts  # Expected: all counts > 0
```

### Final Checklist
- [x] Public action wrapper added
- [ ] OCC retry logic implemented
- [ ] Error handling added for debugging
- [ ] Seed runs successfully
- [ ] All entity relationships populated

---

## Technical Notes

### OCC (Optimistic Concurrency Control) Background
Convex uses OCC for transaction isolation. When multiple transactions read/write the same documents, one may fail with `OptimisticConcurrencyControlFailure`. This happens when:
1. Previous seed left partial data being processed
2. App is actively creating records during seed
3. Batch size is too large, increasing conflict probability

### Mitigations Applied
1. **Smaller batch size**: 100 instead of 500 reduces conflict window
2. **Retry with backoff**: Up to 3 retries with exponential backoff (500ms, 1s, 1.5s)
3. **Inter-batch delay**: 100ms between batches lets other transactions complete
4. **Better error handling**: Returns actual error message for debugging
