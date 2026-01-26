# Location & Tracking Page - Complete Redesign

## Context

### Original Request
Implement the Location & Tracking design from the HTML mockup file (`museumlite.aura.build.html`), rewriting from scratch with real Convex data. Ship this week.

### Interview Summary
**Key Discussions**:
- User wants **Complete Redesign** (not refinement of existing components)
- Use **Real Convex Data** (not static mockup data)
- **Ship This Week** - focus on core functionality, polish later
- **Hybrid Testing** - Backend tests for new queries, manual browser testing for UI
- **Auto-detect View by Location Type** - Exhibition locations show Gallery View, Storage locations show Storage View

**Research Findings**:
- Existing page at `/apps/app/src/app/[locale]/(dashboard)/locations/page.tsx` with mock data
- Convex has `locations`, `environmentalReadings`, `locationHistory` tables
- Missing query: `getEnvironmentalReadings` for temp/humidity display
- UI components available: KpiCard, DataTable, sidebar system
- Design system: dark theme, zinc-950 bg, border-white/10, indigo accents

### Metis Review
**Identified Gaps** (addressed):
- Environmental readings query missing → Will create new query
- Scope creep risks (drag-drop, alerts) → Locked down in guardrails
- Edge cases (empty states, long names) → Default behaviors defined

---

## Work Objectives

### Core Objective
Rewrite the Location & Tracking page from scratch to match the HTML mockup design, wired to real Convex data, with automatic view switching based on location type.

### Concrete Deliverables
1. New `LocationTrackingPage` component replacing existing locations page
2. New `LocationSidebar` component (Exhibition Spaces + Secure Storage sections)
3. New `LocationHeader` component (breadcrumb, title, status, environmental cards)
4. New `GalleryView` component (vitrines grid, wall display, secure drawers)
5. New `StorageView` component (stats cards, storage units table)
6. New Convex query `getEnvironmentalReadings` for temp/humidity data
7. Backend tests for new queries

### Definition of Done
- [ ] Page renders matching mockup layout (visual comparison) - **REQUIRES MANUAL BROWSER TESTING**
- [x] All data comes from Convex queries (no hardcoded mock data)
- [x] Exhibition locations auto-show Gallery View (logic implemented in page.tsx)
- [x] Storage locations auto-show Storage View (logic implemented in page.tsx)
- [x] `bun run typecheck` passes with no errors
- [x] `bun test` passes (backend tests)
- [ ] Manual browser testing completes successfully - **REQUIRES HUMAN VERIFICATION**

### Must Have
- Two-panel layout: 240px sidebar + main content
- Sidebar with Exhibition Spaces and Secure Storage sections
- Status indicators (dots) for each location
- Header with breadcrumb, title, status badge, temp/humidity cards
- Gallery View with vitrines grid visualization
- Storage View with stats cards and table
- Real data from Convex queries
- Type-based automatic view switching

### Must NOT Have (Guardrails)
- Mobile responsive redesign (not in mockup scope)
- Drag-and-drop object movement (feature creep)
- Real-time environmental alerts (not in mockup)
- Location tree editing from this page (separate workflow)
- Animations beyond basic hover states (ship this week)
- New database schema fields for slot positions (requires migration)
- Object thumbnail images in vitrines (use icon placeholders like mockup)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest in packages/backend)
- **User wants tests**: Hybrid - Backend tests + Manual UI
- **Framework**: vitest

### Backend Tests
New Convex queries will have tests in `packages/backend/convex/*.test.ts`:
- `getEnvironmentalReadings` query test
- Any other new queries added during implementation

### Manual UI Testing
Each component verified in browser with `bun dev`:
- Navigate to `/locations` page
- Click sidebar items to switch locations
- Verify view switches (Gallery vs Storage) based on location type
- Check environmental data displays
- Screenshot comparison with mockup

---

## Task Flow

```
Task 1 (Backend Query) 
    ↓
Task 2 (Sidebar) → Task 3 (Header) [parallel]
    ↓              ↓
Task 4 (Gallery View)
    ↓
Task 5 (Storage View)
    ↓
Task 6 (Page Assembly + Wiring)
    ↓
Task 7 (Cleanup + Final Verification)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 3 | Sidebar and Header are independent UI components |

| Task | Depends On | Reason |
|------|------------|--------|
| 4 | 1 | Gallery View needs environmental data query |
| 5 | 1 | Storage View needs queries |
| 6 | 2, 3, 4, 5 | Page assembly needs all components |
| 7 | 6 | Cleanup after assembly |

---

## TODOs

- [x] 1. Create `getEnvironmentalReadings` Convex Query + Test

  **What to do**:
  - Create new query in `packages/backend/convex/locations.ts`
  - Query `environmentalReadings` table for latest readings by locationId
  - Return: temperature, humidity, recordedAt
  - If no readings exist, return null (frontend handles empty state)
  - Write test in `packages/backend/convex/locations.test.ts`

  **Must NOT do**:
  - Don't modify the schema
  - Don't add alert/threshold logic
  - Don't add historical trend queries

  **Parallelizable**: NO (foundation for other tasks)

  **References**:

  **Pattern References**:
  - `packages/backend/convex/locations.ts:getOccupancy` - Query pattern for location-specific data
  - `packages/backend/convex/conservationTreatments.ts:2314-2328` - Environmental readings schema reference

  **Schema References**:
  - `packages/backend/convex/schema.ts:environmentalReadings` - Table structure

  **Test References**:
  - `packages/backend/convex/locations.test.ts` - Existing test patterns

  **Acceptance Criteria**:

  **Backend Test:**
  - [x] Test file: `packages/backend/convex/locations.test.ts`
  - [x] Test covers: Query with readings, query without readings (returns null)
  - [x] `bun test locations.test.ts` → PASS

  **Manual Verification:**
  - [x] In Convex dashboard, run query with valid locationId
  - [x] Verify response shape: `{ temperature: number, humidity: number, recordedAt: number } | null`

  **Commit**: YES
  - Message: `feat(backend): add getEnvironmentalReadings query for location page`
  - Files: `packages/backend/convex/locations.ts`, `packages/backend/convex/locations.test.ts`
  - Pre-commit: `bun test locations.test.ts`

---

- [x] 2. Create New `LocationSidebar` Component

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/locations/_components/location-sidebar-new.tsx`
  - 240px width sidebar with two sections:
    - "Exhibition Spaces" section header
    - "Secure Storage" section header
  - Each location item shows:
    - Name (truncate if long)
    - Status dot (emerald=active, amber=maintenance, grey=inactive)
    - Lock icon for secure storage locations
    - Temperature badge for cold storage
  - Active state: bg-zinc-900, border-l-2 border-indigo-500
  - Query: use existing `locations.listAll` filtered by type
  - On click: call `onSelectLocation(locationId)` callback

  **Must NOT do**:
  - No nested tree structure (flat list by section)
  - No location editing/adding
  - No drag-and-drop reordering

  **Parallelizable**: YES (with Task 3)

  **References**:

  **Pattern References**:
  - `museumlite.aura.build.html:2613-2666` - HTML mockup sidebar design
  - `apps/app/src/components/app-sidebar.tsx:NavSection` - Section header pattern
  - `packages/ui/src/components/sidebar.tsx` - Sidebar primitives

  **API/Type References**:
  - `packages/backend/convex/locations.ts:listAll` - Query for locations

  **Acceptance Criteria**:

  **Manual Browser Verification:**
  - [ ] Using browser at `http://localhost:3000/locations`:
    - Sidebar renders at 240px width
    - "Exhibition Spaces" section shows exhibition-type locations
    - "Secure Storage" section shows storage-type locations
    - Clicking a location triggers callback
    - Active location has indigo border highlight

  **TypeScript:**
  - [x] `bun run typecheck` → passes, no errors in new file

  **Commit**: YES
  - Message: `feat(locations): add new LocationSidebar component matching mockup`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/_components/location-sidebar-new.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 3. Create New `LocationHeader` Component

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/locations/_components/location-header-new.tsx`
  - Layout: flex justify-between
  - Left side:
    - Breadcrumb: "Locations > {parentType}" (text-zinc-500)
    - Title: location name (text-2xl font-bold)
    - Status badge (emerald "Open to Public", amber "Maintenance", etc.)
  - Right side:
    - Temperature card (blue icon, value in °C)
    - Humidity card (cyan icon, value in % RH)
  - Use KpiCard-style styling for env cards
  - Props: `location: Location`, `environmentalData: { temperature, humidity } | null`

  **Must NOT do**:
  - No edit buttons in header
  - No environmental alerts/warnings
  - No historical trend indicators

  **Parallelizable**: YES (with Task 2)

  **References**:

  **Pattern References**:
  - `museumlite.aura.build.html:2669-2723` - HTML mockup header design
  - `packages/ui/src/components/kpi-card.tsx` - Stats card styling pattern

  **API/Type References**:
  - `packages/backend/convex/locations.ts:Location` - Location type

  **Acceptance Criteria**:

  **Manual Browser Verification:**
  - [ ] Header renders with breadcrumb, title, status badge
  - [ ] Environmental cards show temperature and humidity
  - [ ] If no environmental data, cards show "N/A"

  **TypeScript:**
  - [x] `bun run typecheck` → passes

  **Commit**: YES
  - Message: `feat(locations): add new LocationHeader component with env cards`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/_components/location-header-new.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 4. Create New `GalleryView` Component

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/locations/_components/gallery-view-new.tsx`
  - Three sections:
    1. **Freestanding Vitrines** - 4-column grid of glass case cards
       - Each case: aspect-[4/5], rounded-xl, glass effect (border-white/5, backdrop-blur)
       - Header: case ID (VIT-01), status dot
       - Content: SVG icons representing objects (lucide-react)
       - Empty slots: dashed border, "Empty" text
    2. **Wall Mounted Display** - 6-column grid of smaller slots
       - Each slot: aspect-[3/4], dark bg with subtle texture
       - Show object icon or "Empty"
    3. **Secure Drawers** - 4 drawer rows
       - Each: h-10, with status dot, drawer ID, content label
  - Query objects at location using `getObjectsAtLocation`
  - Map first N objects to display slots (vitrines first, then wall, then drawers)

  **Must NOT do**:
  - No object detail modals (link to /collections/[id] instead)
  - No drag-and-drop
  - No slot assignment editing

  **Parallelizable**: NO (depends on Task 1)

  **References**:

  **Pattern References**:
  - `museumlite.aura.build.html:2726-3041` - HTML mockup gallery view design
  - Glass effect: `border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md`

  **API/Type References**:
  - `packages/backend/convex/locations.ts:getObjectsAtLocation` - Objects query

  **Acceptance Criteria**:

  **Manual Browser Verification:**
  - [ ] Vitrines grid renders 4 glass case cards
  - [ ] Wall display renders 6 slots
  - [ ] Secure drawers render 4 rows
  - [ ] Objects from location appear in slots
  - [ ] Empty slots show "Empty" placeholder
  - [ ] Hovering object shows tooltip with name

  **TypeScript:**
  - [x] `bun run typecheck` → passes

  **Commit**: YES
  - Message: `feat(locations): add GalleryView component with vitrines, wall display, drawers`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/_components/gallery-view-new.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 5. Create New `StorageView` Component

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/locations/_components/storage-view-new.tsx`
  - Two sections:
    1. **Stats Cards** - 3-column grid
       - Capacity: "85% Full" with progress bar
       - Total Items: count from query
       - Last Audit: date (or "Never" if no audit)
    2. **Storage Units Table**
       - Columns: Unit/Shelf, Classification, Occupancy, Status
       - Use DataTable component or custom table
       - Status colors: emerald=Accessible, amber=Locked, rose=Restricted
  - Query child locations (storage units) using `listAll` with parentLocationId filter

  **Must NOT do**:
  - No sorting/filtering on table
  - No inline editing
  - No audit workflow

  **Parallelizable**: NO (depends on Task 1)

  **References**:

  **Pattern References**:
  - `museumlite.aura.build.html:3042-3136` - HTML mockup storage view design
  - `packages/ui/src/components/data-table.tsx` - Table component

  **API/Type References**:
  - `packages/backend/convex/locations.ts:getOccupancy` - Occupancy data

  **Acceptance Criteria**:

  **Manual Browser Verification:**
  - [ ] Stats cards render with capacity, items, audit date
  - [ ] Progress bar shows utilization percentage
  - [ ] Table renders storage units with status badges
  - [ ] Status colors match (emerald, amber, rose)

  **TypeScript:**
  - [x] `bun run typecheck` → passes

  **Commit**: YES
  - Message: `feat(locations): add StorageView component with stats and units table`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/_components/storage-view-new.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 6. Assemble New Locations Page

  **What to do**:
  - Replace content in `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`
  - Layout: flex with sidebar (240px) + main content
  - State: `selectedLocationId` (useState, default to first exhibition location)
  - Queries:
    - `locations.listAll` for sidebar
    - `locations.get` for selected location details
    - `locations.getEnvironmentalReadings` for header
    - `locations.getObjectsAtLocation` for gallery view
    - `locations.getOccupancy` for storage view
  - View switching logic:
    - If location.type is "exhibition", "gallery", "wing" → show GalleryView
    - If location.type is "storage", "vault", "cold_storage" → show StorageView
  - Loading state: skeleton for each section
  - Empty state: "Select a location" if none selected

  **Must NOT do**:
  - Don't break existing `/locations/[id]` detail page
  - Don't remove old components yet (cleanup in next task)

  **Parallelizable**: NO (depends on 2, 3, 4, 5)

  **References**:

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx` - Current page structure
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Sidebar + content layout pattern

  **API/Type References**:
  - All queries referenced in previous tasks

  **Acceptance Criteria**:

  **Manual Browser Verification:**
  - [ ] Navigate to `http://localhost:3000/locations`
  - [ ] Sidebar loads with locations
  - [ ] Clicking exhibition location shows GalleryView
  - [ ] Clicking storage location shows StorageView
  - [ ] Environmental data displays in header
  - [ ] Objects appear in vitrines/table
  - [ ] No TypeScript errors in console
  - [ ] Compare with mockup: layout matches

  **TypeScript:**
  - [x] `bun run typecheck` → passes

  **Commit**: YES
  - Message: `feat(locations): assemble new location tracking page with auto-view switching`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 7. Cleanup Old Components + Final Verification

  **What to do**:
  - Delete old component files that are replaced:
    - `apps/app/src/app/[locale]/(dashboard)/locations/_components/location-sidebar.tsx` (if exists)
    - `apps/app/src/app/[locale]/(dashboard)/locations/_components/vitrines-grid.tsx` (if exists)
    - `apps/app/src/app/[locale]/(dashboard)/locations/_components/wall-display.tsx` (if exists)
    - `apps/app/src/app/[locale]/(dashboard)/locations/_components/secure-drawers.tsx` (if exists)
    - `apps/app/src/app/[locale]/(dashboard)/locations/_components/storage-units-table.tsx` (if exists)
  - Remove `-new` suffix from new component filenames
  - Run full verification suite
  - Test `/locations/[id]` page still works (should use different components)

  **Must NOT do**:
  - Don't delete components used by other pages
  - Don't modify `/locations/[id]/page.tsx`

  **Parallelizable**: NO (final task)

  **References**:

  **Pattern References**:
  - Check imports across codebase before deleting

  **Acceptance Criteria**:

  **Full Verification:**
  - [x] `bun run typecheck` → passes (all workspaces)
  - [x] `bun run lint` → passes
  - [x] `bun test` → passes (backend tests)
  - [ ] Manual: `/locations` page matches mockup
  - [ ] Manual: `/locations/[id]` detail page still works
  - [ ] Manual: No console errors

  **Commit**: YES
  - Message: `refactor(locations): cleanup old components, finalize redesign`
  - Files: Deleted old files, renamed new files
  - Pre-commit: `bun run typecheck && bun run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(backend): add getEnvironmentalReadings query` | locations.ts, locations.test.ts | bun test |
| 2 | `feat(locations): add LocationSidebar component` | location-sidebar-new.tsx | typecheck |
| 3 | `feat(locations): add LocationHeader component` | location-header-new.tsx | typecheck |
| 4 | `feat(locations): add GalleryView component` | gallery-view-new.tsx | typecheck |
| 5 | `feat(locations): add StorageView component` | storage-view-new.tsx | typecheck |
| 6 | `feat(locations): assemble location tracking page` | page.tsx | typecheck |
| 7 | `refactor(locations): cleanup and finalize` | multiple | typecheck, lint, test |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: no errors
bun run lint       # Expected: no errors
bun test           # Expected: all tests pass
bun dev            # Expected: page renders at localhost:3000/locations
```

### Final Checklist
- [x] All "Must Have" features present
- [x] All "Must NOT Have" exclusions respected
- [ ] Visual comparison with mockup passes (requires manual browser testing)
- [x] All tests pass
- [x] No TypeScript errors
- [ ] Existing /locations/[id] page unbroken (requires manual browser testing)
