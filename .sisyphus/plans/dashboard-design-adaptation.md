# Dashboard Design Adaptation - Pixel-Perfect UI Overhaul

## Context

### Original Request
Adapt/convert the dashboard page design to pixel-perfect match the reference design in `museumlite.aura.build.html`. Full UI overhaul including sidebar, header, dashboard content, and navigation styling.

### Interview Summary
**Key Discussions**:
- Scope: Full UI Overhaul - sidebar, header, dashboard content, navigation
- Fidelity: Pixel-Perfect match to reference design
- Animations: Include animate-enter, hover effects, staggered reveals
- Feature Preservation: Match reference exactly - replace AssignmentsQueue/NewArrivalsFeed with Collection cards grid + Recent Activity Log table
- Verification: Manual browser visual testing only

**Research Findings**:
- Codebase uses Tailwind v4 + shadcn/ui with dark theme
- Existing KpiCard component exists but needs pixel-perfect restyling
- Reference uses Inter font; codebase uses Geist - will keep Geist (design system consistency)
- CSS animations (`animate-enter`) already defined in global styles
- Current dashboard is ~80% structurally similar, needs styling refinement

### Metis Review
**Identified Gaps** (addressed):
- Sparkline charts in KPIs: REMOVE to match reference exactly
- Button routes: Keep existing routes (/objects/new, /collections)
- Mobile sidebar: Preserve existing collapsible behavior
- Recent Activity data: Use existing activity log API
- Font choice: Keep Geist (design system consistency over reference)
- Detail panel on card click: OUT OF SCOPE - cards navigate to existing routes

---

## Work Objectives

### Core Objective
Transform the dashboard UI to pixel-perfect match the reference design while preserving all existing data fetching, permissions, i18n, and responsive behavior.

### Concrete Deliverables
1. Restyled sidebar matching reference visual design
2. Restyled header with breadcrumbs and action buttons
3. Restyled KPI cards (4 stats bar) without sparklines
4. Redesigned collection cards grid with exact hover/animation effects
5. New Recent Activity Log table component
6. Animation CSS for enter/hover effects

### Definition of Done
- [ ] Visual comparison shows pixel-perfect match to reference at 1920x1080
- [ ] All existing Convex queries still function correctly
- [ ] Permission gates preserved (analytics view restriction)
- [ ] i18n translation calls preserved
- [ ] Loading/error/empty states preserved
- [ ] Responsive breakpoints work: mobile (1 col) through 2xl (5 cols)
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

### Must Have
- Exact color palette: zinc-950 background, zinc-800 borders, zinc-400 text (via CSS variables)
- Animation timing: 0.4s ease-out for enter, 0.2s for hover transitions
- Staggered animation delays on collection cards
- "View Details" hover badge on cards
- Status badges matching reference styles
- Recent Activity Log with object/action/user/time columns

### Must NOT Have (Guardrails)
- New Convex backend queries (use existing dashboard APIs)
- Changes to shadcn Sidebar component structure (styling only)
- Removal of i18n translation calls
- Hardcoded routes on header buttons (use existing routes)
- Changes to pages outside dashboard (/objects, /loans, etc.)
- Breaking changes to mobile collapsible sidebar behavior
- Light theme styling (reference is dark-only)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest)
- **User wants tests**: Manual-only
- **Framework**: N/A for this task

### If Manual QA Only

Each TODO includes detailed verification procedures using Playwright browser automation for visual verification.

**Evidence Required:**
- Screenshots for visual changes
- TypeScript compilation verification
- Lint verification

---

## Task Flow

```
Task 0 (CSS Setup)
      ↓
Task 1 (Header) → Task 2 (KPI Cards) → Task 3 (Collection Cards) → Task 4 (Activity Log)
                                                                          ↓
                                                                    Task 5 (Sidebar)
                                                                          ↓
                                                                    Task 6 (Integration)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1, 2 | Independent components after CSS setup |

| Task | Depends On | Reason |
|------|------------|--------|
| 1-5 | 0 | Need CSS variables/animations defined |
| 4 | 3 | Activity log appears below cards |
| 5 | 1-4 | Sidebar last (highest coupling) |
| 6 | All | Integration testing |

---

## TODOs

- [x] 0. Verify and Extend CSS Variables and Animations

  **What to do**:
  - EXISTING: `animate-enter`, `hover-trigger/hover-target`, `glass-panel` already in globals.css
  - Verify dark theme CSS variables match reference zinc palette
  - Add any missing utility classes if needed (likely minimal changes)

  **Must NOT do**:
  - Don't break existing dark theme
  - Don't remove existing animations

  **Parallelizable**: NO (foundation for all other tasks)

  **References**:
  
  **Pattern References**:
  - `packages/ui/src/globals.css:27-50` - Existing animation patterns
  - `museumlite.aura.build.html:93-147` - Reference CSS (animate-enter, glass-panel)

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/`
    - Verify: CSS loads without console errors
  - [ ] `bun run typecheck` passes
  - [ ] `bun run lint` passes

  **Commit**: YES
  - Message: `style(ui): add animation keyframes and CSS variables for dashboard redesign`
  - Files: `packages/ui/src/globals.css`
  - Pre-commit: `bun run lint`

---

- [x] 1. Restyle Dashboard Header

  **What to do**:
  - Update header in layout.tsx to match reference (h-14, border-b, backdrop-blur-xl)
  - Add breadcrumb: "MuseumLite / {Page Title}" format
  - Add "Add Object" button (secondary style, routes to /objects/new)
  - Add "New Exhibition" button (primary indigo, routes to /exhibitions/new)
  - Preserve SidebarTrigger, CommandPalette, NotificationBell

  **Must NOT do**:
  - Don't remove existing functionality (search, notifications)
  - Don't change routes of existing elements
  - Don't hardcode organization name (use dynamic from context)

  **Parallelizable**: YES (with Task 2 after Task 0)

  **References**:

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/layout.tsx:58-69` - Current header implementation
  - `museumlite.aura.build.html:633-679` - Reference header design

  **API/Type References**:
  - `useOrganization()` hook for org name in breadcrumb

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/`
    - Verify: Header shows breadcrumb "OrgName / Collections Overview"
    - Verify: "Add Object" button visible and clickable
    - Verify: "New Exhibition" button with indigo background
    - Click "Add Object" → navigates to /objects/new
    - Screenshot: Save to `.sisyphus/evidence/task-1-header.png`
  - [ ] Mobile view (< 768px): buttons collapse appropriately

  **Commit**: YES
  - Message: `style(app): restyle dashboard header with breadcrumbs and action buttons`
  - Files: `apps/app/src/app/[locale]/(dashboard)/layout.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 2. Restyle KPI Stats Cards

  **What to do**:
  - Update KpiCard component to match reference design exactly
  - Remove sparkline chart (reference doesn't have it)
  - Add icon with colored background container (p-2, rounded-md, colored border)
  - Update typography: value text-lg font-semibold, label text-[10px] uppercase tracking-wider
  - Support accent colors: indigo, emerald, amber, blue
  - Update dashboard page to use restyled cards

  **Must NOT do**:
  - Don't change the component API signature (keep backwards compatible)
  - Don't remove loading state skeleton

  **Parallelizable**: YES (with Task 1 after Task 0)

  **References**:

  **Pattern References**:
  - `packages/ui/src/components/kpi-card.tsx` - Current implementation
  - `museumlite.aura.build.html:681-759` - Reference KPI card design
  - `apps/app/src/app/[locale]/(dashboard)/page.tsx:163-196` - KPI card usage

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/`
    - Verify: 4 KPI cards visible in stats bar
    - Verify: Each card has icon with colored background
    - Verify: Values are large (text-lg), labels are small uppercase
    - Verify: No sparkline charts visible
    - Screenshot: Save to `.sisyphus/evidence/task-2-kpi-cards.png`
  - [ ] `bun run typecheck` passes (check all KpiCard usages)

  **Commit**: YES
  - Message: `style(ui): restyle KPI cards to match reference design`
  - Files: `packages/ui/src/components/kpi-card.tsx`, `apps/app/src/app/[locale]/(dashboard)/page.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 3. Redesign Collection Cards Grid

  **What to do**:
  - Update collection card design to match reference exactly
  - Add aspect-[4/3] image area with gradient overlay
  - Add "View Details" hover badge (centered, appears on hover)
  - Add status badge top-left ("Active Dept" style)
  - Add settings button top-right (appears on hover)
  - Implement staggered animation delays: style={{animationDelay: `${index * 100}ms`}}
  - Update grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5
  - Update card stats section: 2x2 grid with label/value pairs (Cataloged Items, Pending Accessions, Storage, Valuation)
  - Add "New Exhibition" dashed card placeholder
  - REMOVE AssignmentsQueue and NewArrivalsFeed components

  **Must NOT do**:
  - Don't change card navigation routes (keep /collections?group=${id})
  - Don't remove permission checks
  - Don't remove i18n translations
  - Don't remove loading/empty states

  **Parallelizable**: NO (after Tasks 1, 2)

  **References**:

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/page.tsx:215-496` - Current card implementation
  - `museumlite.aura.build.html:767-995` - Reference collection cards
  - `museumlite.aura.build.html:967-994` - "New Exhibition" dashed card

  **API/Type References**:
  - `api.dashboard.getAnalytics` - Data source for cards
  - `analytics.recentCollectionGroups` - Collection data

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/`
    - Verify: Collection cards display in responsive grid
    - Verify: Cards have images with gradient overlay
    - Hover over card: "View Details" badge appears with translate animation
    - Hover over card: Settings button appears top-right
    - Verify: Status badge visible top-left
    - Verify: Card stats show 4 data points in 2x2 grid
    - Verify: "New Exhibition" dashed placeholder card present
    - Verify: Cards animate in with staggered delays
    - Screenshot: Save to `.sisyphus/evidence/task-3-cards.png`
  - [ ] AssignmentsQueue and NewArrivalsFeed are removed from page
  - [ ] Responsive: Check at 640px, 1024px, 1280px, 1536px viewports

  **Commit**: YES
  - Message: `feat(app): redesign collection cards grid with animations and hover effects`
  - Files: `apps/app/src/app/[locale]/(dashboard)/page.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 4. Restyle Existing Recent Activity Log Component

  **What to do**:
  - EXISTING component at `apps/app/src/components/recent-activity-log.tsx` - RESTYLE only
  - Update table styling to match reference exactly
  - Style table header: bg-zinc-900/50, text-zinc-500, font-medium
  - Style rows: hover:bg-zinc-900/40, cursor-pointer, divide-y
  - Add avatar/initials for Object column
  - Add colored status badges for Action column (indigo/emerald/amber variants)
  - Add timestamps: right-aligned, font-mono, text-[10px], relative format ("10m ago")
  - Use existing activity data from dashboard API or create stub

  **Must NOT do**:
  - Don't create new Convex queries (use existing or stub)
  - Don't make table rows navigate (just show data for now)

  **Parallelizable**: NO (after Task 3)

  **References**:

  **Pattern References**:
  - `apps/app/src/components/recent-activity-log.tsx` - EXISTING component to restyle
  - `museumlite.aura.build.html:1091-1172` - Reference activity log table styling
  - `apps/app/src/app/[locale]/(dashboard)/page.tsx:6-8` - Import statement for component

  **API/Type References**:
  - `RecentActivityItem` type already defined in component
  - Component is already imported in dashboard page.tsx

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/`
    - Scroll to: Activity log section
    - Verify: Table displays with header row (bg-zinc-900/50 style)
    - Verify: 3+ activity rows visible
    - Verify: Status badges have correct colors
    - Verify: Timestamps are right-aligned, font-mono text-[10px]
    - Hover row: Background changes to bg-zinc-900/40
    - Screenshot: Save to `.sisyphus/evidence/task-4-activity.png`

  **Commit**: YES
  - Message: `style(app): restyle Recent Activity Log to match reference design`
  - Files: `apps/app/src/components/recent-activity-log.tsx`, `apps/app/src/app/[locale]/(dashboard)/page.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 5. Restyle Sidebar Navigation

  **What to do**:
  - Update sidebar styling to match reference (w-64, border-r, bg-zinc-950)
  - Restyle organization switcher: gradient logo, hover states
  - Restyle search input: with ⌘K hint badge
  - Update nav section headers: text-[10px] uppercase tracking-widest
  - Update nav item styling: active state with bg-zinc-800/40, border, shadow
  - Restyle user profile section: avatar with online indicator
  - Preserve all existing functionality (collapsible, dropdowns, navigation)

  **Must NOT do**:
  - Don't change shadcn Sidebar component structure
  - Don't remove feature gating (locked items)
  - Don't remove theme/language switchers
  - Don't break mobile collapsible behavior

  **Parallelizable**: NO (after all other tasks - highest coupling)

  **References**:

  **Pattern References**:
  - `apps/app/src/components/app-sidebar.tsx` - Current implementation
  - `museumlite.aura.build.html:299-628` - Reference sidebar design
  - `packages/ui/src/components/sidebar.tsx` - shadcn sidebar structure

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/`
    - Verify: Sidebar visible on desktop (>768px)
    - Verify: Organization switcher has gradient logo
    - Verify: Search input shows ⌘K hint
    - Verify: Nav sections have uppercase headers
    - Verify: Active nav item has distinct styling
    - Verify: User profile at bottom with online indicator
    - Click sidebar trigger on mobile: Sidebar collapses/expands
    - Screenshot desktop: `.sisyphus/evidence/task-5-sidebar-desktop.png`
    - Screenshot mobile: `.sisyphus/evidence/task-5-sidebar-mobile.png`
  - [ ] Theme switcher still works
  - [ ] Language switcher still works
  - [ ] Logout still works

  **Commit**: YES
  - Message: `style(app): restyle sidebar navigation to match reference design`
  - Files: `apps/app/src/components/app-sidebar.tsx`
  - Pre-commit: `bun run typecheck`

---

- [x] 6. Integration Testing and Polish

  **What to do**:
  - Full visual comparison against reference at multiple viewports
  - Fix any spacing/alignment inconsistencies
  - Verify all hover states and animations
  - Verify all loading states display correctly
  - Verify empty states display correctly
  - Verify permission denied state displays correctly
  - Test dark theme consistency across all components
  - Run full typecheck and lint

  **Must NOT do**:
  - Don't add new features not in reference
  - Don't change functionality

  **Parallelizable**: NO (final integration)

  **References**:

  **Pattern References**:
  - `museumlite.aura.build.html` - Full reference for comparison
  - All modified files from Tasks 0-5

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Full visual comparison at:
    - 1920x1080 (desktop)
    - 1440x900 (laptop)
    - 768x1024 (tablet)
    - 375x812 (mobile)
  - [ ] Test scenarios:
    - Fresh load (loading states)
    - No data (empty states)
    - No permission (access denied)
    - Full data (normal operation)
  - [ ] `bun run typecheck` passes
  - [ ] `bun run lint` passes
  - [ ] `bun dev` runs without errors
  - [ ] Screenshots: Save comparison grid to `.sisyphus/evidence/task-6-final.png`

  **Commit**: YES
  - Message: `chore(app): dashboard design polish and integration fixes`
  - Files: Various as needed
  - Pre-commit: `bun run typecheck && bun run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `style(ui): add animation keyframes and CSS variables` | globals.css | lint |
| 1 | `style(app): restyle dashboard header` | layout.tsx | typecheck |
| 2 | `style(ui): restyle KPI cards` | kpi-card.tsx, page.tsx | typecheck |
| 3 | `feat(app): redesign collection cards grid` | page.tsx | typecheck |
| 4 | `feat(app): add Recent Activity Log component` | _components/*, page.tsx | typecheck |
| 5 | `style(app): restyle sidebar navigation` | app-sidebar.tsx | typecheck |
| 6 | `chore(app): dashboard design polish` | various | typecheck, lint |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: No errors
bun run lint       # Expected: No errors
bun dev            # Expected: Starts without errors
```

### Final Checklist
- [ ] Visual match to reference at 1920x1080
- [ ] All "Must Have" items present
- [ ] All "Must NOT Have" items absent
- [ ] All Convex queries functional
- [ ] All permission gates preserved
- [ ] All i18n translations preserved
- [ ] All loading/error/empty states preserved
- [ ] Responsive at all breakpoints
- [ ] Animations smooth and performant
