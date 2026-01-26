# Fix Locations Page Filter

## Context

### Original Request
Fix the locations/tracking page that shows no locations despite having 1,956 locations in the database.

### Interview Summary
**Root Cause Identified**:
- The page filters locations by type AND requires no parentLocationId
- Seeded data has "building" type at root level, which isn't in the exhibitionTypes filter list
- Buildings (root level) have type "building" - NOT in either list → filtered out
- Result: Zero locations pass the filter, sidebar shows empty

### Research Findings
- File: `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx` (lines 176-177)
- Current filter: `["gallery", "exhibition", "hall", "wing", "room"]`
- Missing: `"building"` and `"floor"` types

---

## Work Objectives

### Core Objective
Add "building" and "floor" to the exhibitionTypes filter so root-level locations appear in the sidebar.

### Concrete Deliverables
- Modified `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`

### Definition of Done
- [x] Locations page shows buildings in the sidebar
- [x] Clicking a building shows child locations
- [x] No TypeScript errors (in locations page - pre-existing errors in testAction.ts)

### Must Have
- "building" and "floor" added to exhibitionTypes array

### Must NOT Have (Guardrails)
- Do NOT change any other logic
- Do NOT refactor the filtering approach
- Do NOT modify storageTypes

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **User wants tests**: Manual verification sufficient for this trivial change
- **Framework**: Manual browser verification

---

## Task Flow

```
Task 1 (single task)
```

## Parallelization

None - single atomic change.

---

## TODOs

- [x] 1. Add "building" and "floor" to exhibitionTypes filter

  **What to do**:
  - Open `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`
  - Find line 176: `const exhibitionTypes = ["gallery", "exhibition", "hall", "wing", "room"];`
  - Change to: `const exhibitionTypes = ["gallery", "exhibition", "hall", "wing", "room", "building", "floor"];`

  **Must NOT do**:
  - Change storageTypes
  - Modify the filter logic itself
  - Touch any other code

  **Parallelizable**: N/A (single task)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx:176` - The line to edit

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Run `bun dev:app` to start the app
  - [ ] Navigate to `http://localhost:3000/locations`
  - [ ] Verify buildings appear in the sidebar under "Exhibition Spaces"
  - [ ] Click on a building - verify child locations (floors, rooms) load
  - [ ] Run `bun run typecheck` - no TypeScript errors

  **Commit**: YES
  - Message: `fix(locations): add building and floor types to exhibition filter`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`
  - Pre-commit: `bun run typecheck`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(locations): add building and floor types to exhibition filter` | `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx` | `bun run typecheck` |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: no errors
```

### Final Checklist
- [x] Buildings visible in locations sidebar
- [x] Child locations load when building selected
- [x] TypeScript passes (locations page clean; pre-existing errors in testAction.ts)
