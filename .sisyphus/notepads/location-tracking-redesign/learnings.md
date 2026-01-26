# Learnings - Location Tracking Redesign

## [2026-01-26] Task 1 - Already Complete

### Discovery
Task 1 (`getEnvironmentalReadings` query) was **already implemented** with full test coverage:
- Query exists at `packages/backend/convex/locations.ts:495-533`
- Tests exist at `packages/backend/tests/locations.test.ts:145-238`
- All 11 tests passing (including 2 environmental readings tests)

### Query Implementation
```typescript
export const getEnvironmentalReadings = query({
  args: {
    locationId: v.id("locations"),
  },
  returns: v.union(
    v.object({
      temperature: v.optional(v.number()),
      humidity: v.optional(v.number()),
      recordedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    // Permission check
    // Query latest reading with by_location_and_time index
    // Return null if no readings exist
  },
});
```

### Test Coverage
- ✅ Returns latest reading when data exists
- ✅ Returns null when no readings exist
- ✅ Permission checking enforced
- ✅ Uses proper index (`by_location_and_time`)

### Existing Components Found
Located in `/apps/app/src/components/locations/`:
- `location-sidebar.tsx` - 240px sidebar with exhibition/storage sections
- `location-stats.tsx` - Temperature/humidity display
- `occupancy-display.tsx` - Capacity stats
- `vitrines-grid.tsx` - Glass case grid display
- `wall-display.tsx` - Wall-mounted slots
- `secure-drawers.tsx` - Drawer rows
- `storage-units-table.tsx` - Storage table

### Pattern: Two-Panel Layout
Current page uses:
- Left: `w-60` sidebar (240px)
- Right: `flex-1` content area
- Sidebar has `overflow-y-auto custom-scrollbar`
- Content has `bg-gradient-to-br from-background to-card/70`

### Next Steps
Task 2 & 3 can be done in parallel (sidebar + header components).
