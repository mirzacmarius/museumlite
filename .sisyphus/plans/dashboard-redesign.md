# Dashboard Redesign - Collections Overview

## Context

### Original Request
Adapt/convert dashboard page design same as in `museumlite.aura.build.html` - full dashboard redesign to match the Collections Overview design reference.

### Interview Summary
**Key Discussions**:
- Full redesign scope: Remove AssignmentsQueue, NewArrivalsFeed, charts, activity log from dashboard
- Keep these components files (used in permission fallback state)
- Add backend fields: storageLocation and valuation to collectionGroups
- Track "Items on Display" using existing displayStatus field with value "on_display"
- Backend tests only (no E2E infrastructure exists)

**Research Findings**:
- collectionGroups schema at `schema.ts:215-234` - missing storageLocation, valuation
- displayStatus field exists on collections table (`schema.ts:346`) - use for aggregation
- dashboard.getAnalytics at `dashboard.ts:19-321` - returns objects, loans, accessions, recentCollectionGroups
- Existing test patterns in `packages/backend/tests/dashboard.test.ts`

### Metis Review
**Identified Gaps** (addressed):
- AssignmentsQueue/NewArrivalsFeed used in permission fallback → Keep files, only remove from main render
- No E2E infrastructure → Backend tests only
- displayStatus is flexible string → Use "on_display" literal
- Schema changes need migration → Use v.optional() for backward compatibility

---

## Work Objectives

### Core Objective
Redesign the dashboard page to match the Collections Overview design from `museumlite.aura.build.html`, with updated backend schema and API to support new data fields.

### Concrete Deliverables
1. Updated collectionGroups schema with storageLocation and valuation fields
2. Updated getAnalytics query with itemsOnDisplay count and new fields
3. Redesigned dashboard page matching design reference
4. Backend tests for new analytics functionality

### Definition of Done
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun test dashboard.test.ts` passes (all tests including new ones)
- [ ] Dashboard page renders stats bar + collection grid only
- [ ] Collection cards show storage and valuation (or "-" if null)

### Must Have
- Stats bar with 4 KPIs: Total Objects, Items on Display, Pending Accessions, Active Loans
- Collection grid with enhanced cards matching design
- Backend support for storageLocation and valuation
- itemsOnDisplay count in analytics

### Must NOT Have (Guardrails)
- Do NOT delete AssignmentsQueue, NewArrivalsFeed, chart component files (used elsewhere)
- Do NOT add required fields to schema (breaks existing data)
- Do NOT create Playwright/E2E tests (no infrastructure)
- Do NOT change displayStatus field location (it's on collections table)
- Do NOT add new dependencies or libraries
- Do NOT modify sidebar or other pages
- Do NOT use hardcoded zinc-* colors (use CSS variables)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (convex-test for backend)
- **User wants tests**: Backend unit tests only
- **Framework**: vitest with convex-test

### Backend Tests
Each new feature requires test coverage following existing patterns in `packages/backend/tests/dashboard.test.ts`

### Manual QA Protocol
- Visual verification in dev environment (`bun dev:app`)
- Compare against `museumlite.aura.build.html` reference
- Test permission fallback state (should still show AssignmentsQueue)

---

## Task Flow

```
Milestone 1: Backend Schema
├── Task 1.1: Add storageLocation and valuation to collectionGroups
└── Task 1.2: Run typecheck and verify codegen

Milestone 2: Backend API
├── Task 2.1: Add itemsOnDisplay count to getAnalytics
├── Task 2.2: Add storageLocation/valuation to recentCollectionGroups
└── Task 2.3: Add backend tests

Milestone 3: Frontend Redesign
├── Task 3.1: Update KPI stats bar (4 cards with new layout)
├── Task 3.2: Enhance collection cards with new fields
├── Task 3.3: Remove charts and activity log sections
└── Task 3.4: Final visual polish and verification
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1.1, 1.2 | Sequential schema changes |
| B | 2.1, 2.2, 2.3 | Sequential API changes |
| C | 3.1, 3.2, 3.3, 3.4 | Sequential frontend changes |

| Task | Depends On | Reason |
|------|------------|--------|
| 2.* | 1.2 | API needs schema changes |
| 3.* | 2.3 | Frontend needs API changes |

---

## TODOs

---

### Milestone 1: Backend Schema

---

### - [x] 1.1 Add storageLocation and valuation to collectionGroups Schema

**What to do**:
- Add `storageLocation: v.optional(v.string())` to collectionGroups table
- Add `valuation: v.optional(v.number())` to collectionGroups table
- Both fields MUST be optional to avoid migration

**Must NOT do**:
- Do NOT add as required fields
- Do NOT add indexes (not needed for display)
- Do NOT modify collections table

**Parallelizable**: NO (first task)

**References**:

**Pattern References**:
- `packages/backend/convex/schema.ts:215-234` - Current collectionGroups definition

**Acceptance Criteria**:
- [ ] `storageLocation: v.optional(v.string())` added to collectionGroups table
- [ ] `valuation: v.optional(v.number())` added to collectionGroups table
- [ ] No syntax errors in schema.ts

**Commit**: NO (groups with 1.2)

---

### - [x] 1.2 Run Typecheck and Verify Codegen

**What to do**:
- Run `bun run typecheck` from project root
- Verify Convex codegen completes without errors
- Check that `_generated/dataModel.d.ts` includes new fields

**Must NOT do**:
- Do NOT proceed if typecheck fails
- Do NOT modify generated files manually

**Parallelizable**: NO (depends on 1.1)

**References**:

**API/Type References**:
- `packages/backend/convex/_generated/dataModel.d.ts` - Generated types

**Acceptance Criteria**:
- [ ] `bun run typecheck` passes (6/6 workspaces)
- [ ] Codegen includes storageLocation and valuation in CollectionGroups type

**Manual Execution Verification**:
- [ ] Command: `bun run typecheck`
- [ ] Expected: "Tasks: 6 successful, 6 total"
- [ ] Command: `grep -A5 "collectionGroups" packages/backend/convex/_generated/dataModel.d.ts | head -20`
- [ ] Expected: Shows storageLocation and valuation fields

**Commit**: YES
- Message: `feat(schema): add storageLocation and valuation to collectionGroups`
- Files: `packages/backend/convex/schema.ts`
- Pre-commit: `bun run typecheck`

---

### Milestone 2: Backend API

---

### - [x] 2.1 Add itemsOnDisplay Count to getAnalytics

**What to do**:
- Add `onDisplay: v.number()` to objects return type in getAnalytics
- Query collections table and count where `displayStatus === "on_display"`
- Add to existing objects aggregation logic

**Must NOT do**:
- Do NOT create new index (filter is acceptable for this use case)
- Do NOT modify displayStatus field definition
- Do NOT remove existing fields from return type

**Parallelizable**: NO (depends on 1.2)

**References**:

**Pattern References**:
- `packages/backend/convex/dashboard.ts:19-321` - getAnalytics function
- `packages/backend/convex/dashboard.ts:746-794` - Existing aggregation patterns (reduce with Map)

**API/Type References**:
- `packages/backend/convex/schema.ts:346` - displayStatus field location

**Acceptance Criteria**:
- [ ] `objects.onDisplay` returned from getAnalytics
- [ ] Count is correct (collections where displayStatus === "on_display")
- [ ] Existing objects fields (total, active, loaned, deaccessioned) unchanged
- [ ] `bun run typecheck` passes

**Commit**: NO (groups with 2.2)

---

### - [x] 2.2 Add storageLocation and valuation to recentCollectionGroups

**What to do**:
- Add `storageLocation: v.optional(v.string())` to recentCollectionGroups return type
- Add `valuation: v.optional(v.number())` to recentCollectionGroups return type
- Include these fields in the query/mapping for recentCollectionGroups

**Must NOT do**:
- Do NOT remove existing fields
- Do NOT change query limit or sorting

**Parallelizable**: YES (with 2.1, but sequential in practice)

**References**:

**Pattern References**:
- `packages/backend/convex/dashboard.ts:19-321` - getAnalytics function
- `packages/backend/convex/collectionGroups.ts` - Collection group queries

**Acceptance Criteria**:
- [ ] `recentCollectionGroups` includes storageLocation field
- [ ] `recentCollectionGroups` includes valuation field
- [ ] Fields are null/undefined when not set (not required)
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `feat(api): add itemsOnDisplay and collection metadata to dashboard analytics`
- Files: `packages/backend/convex/dashboard.ts`
- Pre-commit: `bun run typecheck`

---

### - [x] 2.3 Add Backend Tests for New Analytics Fields

**What to do**:
- Add test for `objects.onDisplay` count (should be 0 for new org)
- Add test for `objects.onDisplay` count when collections have displayStatus set
- Add test for `recentCollectionGroups` including new fields
- Follow existing test patterns in dashboard.test.ts

**Must NOT do**:
- Do NOT modify existing tests
- Do NOT create new test file (use existing)
- Do NOT test frontend components

**Parallelizable**: NO (depends on 2.2)

**References**:

**Test References**:
- `packages/backend/tests/dashboard.test.ts` - Existing dashboard tests
- `packages/backend/tests/*.test.ts` - convex-test patterns

**Acceptance Criteria**:
- [ ] Test: getAnalytics returns objects.onDisplay count
- [ ] Test: onDisplay count is 0 when no collections have displayStatus
- [ ] Test: recentCollectionGroups includes storageLocation and valuation
- [ ] All existing dashboard tests still pass
- [ ] Command: `bun test dashboard.test.ts` from packages/backend
- [ ] Expected: All tests pass

**Manual Execution Verification**:
- [ ] Command: `cd packages/backend && bun test dashboard.test.ts`
- [ ] Expected: All tests pass, including new tests

**Commit**: YES
- Message: `test(dashboard): add tests for itemsOnDisplay and collection metadata`
- Files: `packages/backend/tests/dashboard.test.ts`
- Pre-commit: `bun test dashboard.test.ts`

---

### Milestone 3: Frontend Redesign

---

### - [x] 3.1 Update KPI Stats Bar Layout

**What to do**:
- Update stats bar to show: Total Objects, Items on Display, Pending Accessions, Active Loans
- Use KpiCard component with correct icons and accent colors:
  - Total Objects: Package icon, indigo accent
  - Items on Display: Eye icon, emerald accent
  - Pending Accessions: FileClock icon, amber accent
  - Active Loans: ArrowLeftRight icon, blue accent
- Match design reference layout (4 columns, consistent spacing)

**Must NOT do**:
- Do NOT change KpiCard component itself
- Do NOT use hardcoded zinc colors (use CSS variables)
- Do NOT remove KpiCard loading states

**Parallelizable**: NO (depends on 2.3)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/page.tsx:163-196` - Current stats bar implementation
- `packages/ui/src/kpi-card.tsx` - KpiCard component

**Design References**:
- `museumlite.aura.build.html:682-759` - Stats bar design

**Acceptance Criteria**:
- [ ] Stats bar shows 4 KPIs matching design
- [ ] Items on Display uses `analytics.objects.onDisplay`
- [ ] Icons and accent colors match design reference
- [ ] Loading states preserved
- [ ] `bun run typecheck` passes

**Commit**: NO (groups with 3.2, 3.3)

---

### - [x] 3.2 Enhance Collection Cards with New Fields

**What to do**:
- Update collection card grid to show enhanced metadata:
  - Cataloged Items (existing itemsCount)
  - Storage location (new field, show "-" if null)
  - Valuation (new field, format as currency, show "-" if null)
- Add hover effects matching design (View Details badge, settings button)
- Match card layout from design reference

**Must NOT do**:
- Do NOT change collection card click behavior (Link to collections)
- Do NOT remove existing card functionality
- Do NOT use hardcoded zinc colors

**Parallelizable**: YES (with 3.1)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/page.tsx:235-321` - Current collection cards
- `museumlite.aura.build.html:767-866` - Design reference card

**Acceptance Criteria**:
- [ ] Cards show storageLocation (or "-" if null)
- [ ] Cards show valuation formatted as currency (or "-" if null)
- [ ] Hover effects match design (View Details badge)
- [ ] Settings button on hover
- [ ] No hardcoded zinc colors

**Commit**: NO (groups with 3.3)

---

### - [x] 3.3 Remove Charts and Activity Log Sections

**What to do**:
- Remove CollectionGrowthChart section from dashboard render
- Remove LoanStatusChart section from dashboard render
- Remove RecentActivityLog section from dashboard render
- Keep component imports (may be used elsewhere in future)
- Keep AssignmentsQueue/NewArrivalsFeed in permission fallback state (lines 134-145)

**Must NOT do**:
- Do NOT delete component files (CollectionGrowthChart, LoanStatusChart, RecentActivityLog)
- Do NOT delete AssignmentsQueue or NewArrivalsFeed files
- Do NOT remove permission fallback UI (lines 119-145)
- Do NOT remove unused imports (let linter handle)

**Parallelizable**: YES (with 3.2)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/page.tsx:198-228` - Charts sections to remove
- `apps/app/src/app/[locale]/(dashboard)/page.tsx:484-488` - Activity log to remove
- `apps/app/src/app/[locale]/(dashboard)/page.tsx:119-145` - Permission fallback (KEEP)

**Acceptance Criteria**:
- [ ] Charts section removed from main dashboard render
- [ ] Activity log section removed from main dashboard render
- [ ] Permission fallback still shows AssignmentsQueue (lines 134-145)
- [ ] Component files NOT deleted
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes (may have unused import warnings)

**Commit**: YES
- Message: `feat(dashboard): redesign to match Collections Overview design`
- Files: `apps/app/src/app/[locale]/(dashboard)/page.tsx`
- Pre-commit: `bun run typecheck && bun run lint`

---

### - [x] 3.4 Final Visual Polish and Verification

**What to do**:
- Run dev server and visually compare to design reference
- Verify all hover effects work correctly
- Verify responsive layout (2/3/4/5 column grid)
- Fix any visual discrepancies
- Clean up unused imports

**Must NOT do**:
- Do NOT add new animations or effects beyond design
- Do NOT change colors beyond CSS variables

**Parallelizable**: NO (final task)

**References**:

**Design References**:
- `museumlite.aura.build.html` - Full design reference

**Acceptance Criteria**:
- [ ] Dashboard visually matches design reference
- [ ] Stats bar correct (4 KPIs with icons/colors)
- [ ] Collection cards show all metadata
- [ ] Hover effects work (View Details, settings button)
- [ ] No charts or activity log visible
- [ ] Permission fallback state works (test by removing analytics permission)
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

**Manual Execution Verification**:
- [ ] Command: `bun dev:app`
- [ ] Navigate to: `http://localhost:3000`
- [ ] Verify: Dashboard matches design reference
- [ ] Verify: All 4 KPI cards show correct data
- [ ] Verify: Collection cards show storage and valuation
- [ ] Screenshot: Save comparison to `.sisyphus/evidence/dashboard-comparison.png`

**Commit**: YES
- Message: `style(dashboard): final polish and cleanup`
- Files: Any remaining changes
- Pre-commit: `bun run typecheck && bun run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1.2 | `feat(schema): add storageLocation and valuation to collectionGroups` | schema.ts | typecheck |
| 2.2 | `feat(api): add itemsOnDisplay and collection metadata to dashboard analytics` | dashboard.ts | typecheck |
| 2.3 | `test(dashboard): add tests for itemsOnDisplay and collection metadata` | dashboard.test.ts | tests pass |
| 3.3 | `feat(dashboard): redesign to match Collections Overview design` | page.tsx | typecheck + lint |
| 3.4 | `style(dashboard): final polish and cleanup` | any remaining | typecheck + lint |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: 6/6 workspaces pass
bun run lint       # Expected: No errors
cd packages/backend && bun test dashboard.test.ts  # Expected: All tests pass
bun dev:app        # Expected: Dashboard renders correctly at localhost:3000
```

### Final Checklist
- [ ] Schema has storageLocation and valuation fields
- [ ] API returns itemsOnDisplay count and collection metadata
- [ ] Dashboard shows 4 KPIs matching design
- [ ] Collection cards show enhanced metadata
- [ ] Charts and activity log removed
- [ ] All tests pass
- [ ] No hardcoded zinc colors
- [ ] Permission fallback preserved
