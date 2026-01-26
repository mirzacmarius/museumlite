# Learnings - add-missing-locations

## 2026-01-26 Session Findings

### Root Cause
- 36 collections without locations all belonged to ONE organization
- That organization had ZERO locations (never seeded with location hierarchy)
- The `assignMissingLocations` mutation correctly skipped them (no valid locations to assign)

### Solution
1. Created temporary `fixMissingOrgLocations.ts` to seed 256 locations for the missing org
2. Ran `assignMissingLocations` which then successfully assigned all 36 collections
3. Each collection got a locationHistory entry with reason "Initial location assignment (migration)"

### Schema Gotcha
- `locations` table requires `sortOrder: v.float64()` (not optional)
- Don't include `createdAt`/`createdBy` - they're not in the locations schema

### Idempotency Confirmed
- `assignMissingLocations` is naturally idempotent
- Only queries collections with `currentLocationId === undefined`
- After assignment, collection no longer matches query
- Second run returns `{ assigned: 0, skipped: 0 }`

### Final Counts
- Locations: 1,700 → 1,956 (+256)
- Collections with location: 454 → 490 (100%)
- Collections without location: 36 → 0
- LocationHistory entries: 724 → 760 (+36)
