# Add Missing Location Assignments

## Context

### Original Request
Add locations and tracking to items that are missing them. Do NOT remove existing data - only add missing assignments.

### Current State (Verified via Database Query)
- **Total collections**: 490
- **Collections WITH location**: 454 (92.7%)
- **Collections WITHOUT location**: 36 (7.3%)
- **Total locations**: 1,700
- **LocationHistory entries**: 724

### Problem
36 collections have `currentLocationId: null/undefined`. These items are not tracked in the location system and won't appear in location-based queries or reports.

---

## Work Objectives

### Core Objective
Assign locations to all 36 collections currently missing `currentLocationId`, and create locationHistory entries for audit trail.

### Concrete Deliverables
- All 36 collections have `currentLocationId` set
- All 36 collections have a locationHistory entry (initial placement)
- Zero collections remain without location assignment

### Definition of Done
- [x] All collections have `currentLocationId !== null`
- [x] 36 new locationHistory entries created
- [x] Existing data unchanged (no deletions)

### Must Have
- Location assignment for all 36 missing collections
- LocationHistory entry for each assignment (audit trail)
- Respect organization boundaries (assign to locations within same org)

### Must NOT Have (Guardrails)
- **No data deletion**: Do NOT clear or reset existing collections/locations
- **No re-assignment**: Do NOT change locations for items that already have one
- **No cross-org assignment**: Only assign locations within the collection's organization
- **No modification to existing locationHistory**: Only ADD new entries

---

## Technical Approach

### Location Assignment Logic
For each collection missing `currentLocationId`:
1. Get the collection's `organizationId`
2. Query locations for that organization (filter to rooms/storage only, not buildings/floors)
3. Pick a random appropriate location (respecting capacity if tracked)
4. Update `collection.currentLocationId`
5. Create `locationHistory` entry:
   - `fromLocationId: undefined` (initial placement)
   - `toLocationId: assignedLocation`
   - `movedBy: seedUserId`
   - `movedAt: Date.now()`
   - `reason: "Initial location assignment (migration)"`

### Existing Patterns to Follow
- `packages/backend/convex/seedMet.ts:4338-4355` - Pattern for updating collection with location
- `packages/backend/convex/locations.ts:641-678` - Pattern for creating locationHistory

---

## TODOs

- [x] 1. Create `assignMissingLocations` internal mutation in seedMet.ts

  **What to do**:
  - Add new internal mutation that:
    1. Queries all collections where `currentLocationId === undefined`
    2. Groups by `organizationId`
    3. For each org, gets available locations (type: room, cabinet, shelf)
    4. For each collection, picks random location and updates
    5. Creates locationHistory entry
  - Should be idempotent (safe to run multiple times)

  **Implementation**:
  ```typescript
  export const assignMissingLocations = internalMutation({
    args: {
      userId: v.id("users"),
    },
    returns: v.object({
      assigned: v.number(),
      skipped: v.number(),
    }),
    handler: async (ctx, args) => {
      // Get all collections missing location
      const collectionsWithoutLocation = await ctx.db
        .query("collections")
        .filter((q) => q.eq(q.field("currentLocationId"), undefined))
        .collect();
      
      if (collectionsWithoutLocation.length === 0) {
        return { assigned: 0, skipped: 0 };
      }
      
      // Group by organization
      const byOrg = new Map<Id<"organizations">, typeof collectionsWithoutLocation>();
      for (const c of collectionsWithoutLocation) {
        const list = byOrg.get(c.organizationId) || [];
        list.push(c);
        byOrg.set(c.organizationId, list);
      }
      
      let assigned = 0;
      let skipped = 0;
      
      for (const [orgId, collections] of byOrg) {
        // Get assignable locations (rooms, cabinets, shelves)
        const locations = await ctx.db
          .query("locations")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .filter((q) => 
            q.and(
              q.eq(q.field("isActive"), true),
              q.or(
                q.eq(q.field("type"), "room"),
                q.eq(q.field("type"), "cabinet"),
                q.eq(q.field("type"), "shelf"),
                q.eq(q.field("type"), "storage")
              )
            )
          )
          .collect();
        
        if (locations.length === 0) {
          skipped += collections.length;
          continue;
        }
        
        for (const collection of collections) {
          const randomLocation = locations[Math.floor(Math.random() * locations.length)]!;
          
          // Update collection
          await ctx.db.patch(collection._id, {
            currentLocationId: randomLocation._id,
          });
          
          // Create history entry
          await ctx.db.insert("locationHistory", {
            collectionId: collection._id,
            fromLocationId: undefined,
            toLocationId: randomLocation._id,
            movedBy: args.userId,
            movedAt: Date.now(),
            reason: "Initial location assignment (migration)",
          });
          
          assigned++;
        }
      }
      
      return { assigned, skipped };
    },
  });
  ```

  **Parallelizable**: NO

  **References**:
  - Schema: `packages/backend/convex/schema.ts:327` - currentLocationId field
  - Schema: `packages/backend/convex/schema.ts:1101-1115` - locationHistory table
  - Pattern: `packages/backend/convex/locations.ts:641-678` - moveObject with history

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes
  - [ ] Function handles empty results gracefully
  - [ ] Function is idempotent (running twice doesn't duplicate)

  **Commit**: NO (groups with task 2)

---

- [x] 2. Create public action wrapper `runAssignMissingLocations`

  **What to do**:
  - Add public action that calls the internal mutation
  - Find seed user ID by email
  - Return result counts

  **Implementation**:
  ```typescript
  export const runAssignMissingLocations = action({
    args: {},
    returns: v.object({
      assigned: v.number(),
      skipped: v.number(),
    }),
    handler: async (ctx) => {
      const userId = await ctx.runQuery(internal.seedMet.findUserByEmail, {
        email: "mirzacmarius@gmail.com",
      });
      
      if (!userId) {
        throw new Error("Seed user not found");
      }
      
      const result = await ctx.runMutation(internal.seedMet.assignMissingLocations, {
        userId,
      });
      
      console.log(`Location assignment complete: ${result.assigned} assigned, ${result.skipped} skipped`);
      return result;
    },
  });
  ```

  **Parallelizable**: NO

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes
  - [ ] Action can be called via CLI

  **Commit**: YES
  - Message: `feat(seed): add migration to assign locations to untracked collections`
  - Files: `packages/backend/convex/seedMet.ts`

---

- [x] 3. Run the location assignment migration

  **What to do**:
  - Deploy to Convex
  - Execute the migration
  - Verify results

  **Commands**:
  ```bash
  cd packages/backend
  bunx convex dev --once
  bunx convex run seedMet:runAssignMissingLocations
  ```

  **Parallelizable**: NO (depends on tasks 1-2)

  **Acceptance Criteria**:
  - [ ] Output shows `assigned: 36` (or close)
  - [ ] Output shows `skipped: 0`
  - [ ] No errors

  **Commit**: NO (no code changes)

---

- [x] 4. Verify all collections now have locations

  **What to do**:
  - Query database to confirm zero collections without location
  - Verify new locationHistory entries exist

  **Commands**:
  ```bash
  # Check collections without locations (should be 0)
  bunx convex run checkLocationState:getLocationStats
  
  # Or create a quick verification query
  ```

  **Parallelizable**: NO (depends on task 3)

  **Acceptance Criteria**:
  - [ ] Collections without location: 0
  - [ ] LocationHistory count increased by ~36
  - [ ] Total collections unchanged (490)

  **Commit**: NO

---

## Success Criteria

### Verification Commands
```bash
cd packages/backend

# Run migration
bunx convex run seedMet:runAssignMissingLocations
# Expected: { assigned: 36, skipped: 0 }

# Verify counts
bunx convex run checkLocationState:getLocationStats
# Expected: collectionsWithoutLocation: 0
```

### Final Checklist
- [x] assignMissingLocations mutation implemented
- [x] Public action wrapper created
- [x] Migration executed successfully
- [x] Zero collections without location
- [x] Existing data unchanged
- [x] LocationHistory entries created for audit trail

---

## Technical Notes

### Why Not Use Existing seedLocationAssignments?
The existing `seedLocationAssignments()` function in seedMetAction.ts is designed for the full seed flow:
1. It expects collections to be newly created
2. It's part of the larger `resetAndSeed` action
3. It may have assumptions about data state

A dedicated migration mutation is safer because:
1. Explicit query for only unassigned collections
2. Idempotent (safe to run multiple times)
3. Does not touch existing assignments
4. Clear audit trail with "migration" reason

### Location Selection Strategy
Locations are filtered to assignable types:
- `room` - Gallery or study rooms
- `cabinet` - Storage cabinets
- `shelf` - Shelf units
- `storage` - General storage areas

Buildings and floors are excluded (too general for object storage).

### Idempotency
The mutation is naturally idempotent because:
1. Query only returns collections with `currentLocationId === undefined`
2. After assignment, collection no longer matches the query
3. Running again returns `{ assigned: 0, skipped: 0 }`
