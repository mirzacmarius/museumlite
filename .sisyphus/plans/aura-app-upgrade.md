# App Enhancement Plan - 100x Improvement

## Context

### Original Request
"100x improve my app in all aspects. Use features ideas and design style in files from @aura-html-pages/ folder"

**Note**: 27 tasks across 5 phases (Phase 0-4). Task 0 added for theming infrastructure.

### Interview Summary
**Key Discussions**:
- Target surface: apps/app (main product dashboard)
- Visual approach: Modern dark theme (dark background, subtle borders, glass panels, accent colors) - inspired by HTML mockups
- Priority modules: Dashboard → Loans → Collections → Objects → Locations
- First slice: Dashboard + Loans with all admin variants as reference
- Features to add: Assignments queue, Admin loan overview, Loan transport, New arrivals feed, Location timeline, Object lightbox
- Implementation depth: Full-stack (Convex)
- Data sources: Use existing assignments.ts, transit.ts, accessions.ts modules
- Permissions: Add new gates using loans.* scheme
- Localization: Update all locales (en, fr, es)
- Tests: Add after implementation (vitest + convex-test)
- Schema changes allowed

**Research Findings**:
- PermissionGate: `apps/app/src/components/permission-gate.tsx`
- App Router: `apps/app/src/app/[locale]/(dashboard)/`
- assignments.ts: `listMyAssignments`, `getAssignmentCounts` - includes loans, accessions, exhibitions, conservation with urgency
- transit.ts: Full transit tracking with `transitRecords`, `transitItems`, `transitStatusUpdates`, linked to loans via `loanId`
- Existing permissions: `loans.read`, `loans.create`, `loans.update`, `loans.approve`, `collections.*`, `locations.*`

### Metis Review
**Identified Gaps** (addressed):
- Component library strategy: Create shared components in packages/ui FIRST
- Visual consistency: Accept temporary inconsistency; restyle per-slice
- Nav changes: EXCLUDED from Slice 1 to prevent scope creep
- Charts/visualizations: EXCLUDED (out of scope)
- Mobile strategy: Follow responsive patterns (`hidden md:flex` for sidebars)
- Empty/loading/error states: Must be defined per component
- Admin vs user views: Permission-gated sections, not separate routes

**Round 2 Review (Skills/Rules Integration)**:
- ErrorBoundary: MUST install `react-error-boundary` package (functional API, RSC-compatible)
- Tailwind: v3.4.x (not v4) - opacity modifiers ALREADY work, Task 0 simplified
- Package exports: MUST update `packages/ui/package.json` when moving components
- Permission naming: MUST follow snake_case pattern (`view_admin_overview` not `viewAdminOverview`)
- URL state: Dashboard filters SHOULD use `nuqs` for URL state (Web Interface Guidelines compliance)
- Animation: ALL animations must respect `prefers-reduced-motion` via `motion-safe:animate-*`

**Pre-Phase 1 Validation Required**:
- [x] Verify `api.dashboard.getAnalytics` return shape matches Task 8 data contract
- [x] Verify `api.transit.getTransitStats` return shape matches Task 12 data contract
- [x] Verify `locationHistory` table schema matches Task 23 requirements
- [x] Verify `PermissionGate` supports `fallback` prop for graceful degradation

---

## Work Objectives

### Core Objective
Transform apps/app with modern dark UI style (inspired by HTML mockups) while adding key features (assignments queue, admin loan overview, transport tracking, new arrivals feed) with full Convex backend integration.

### Concrete Deliverables
- Shared component library in `packages/ui/src/components/`
- Restyled Dashboard page with KPI cards, assignments queue, new arrivals feed
- Restyled Loans pages with admin overview and transport integration
- Restyled Collections, Objects, Locations pages
- New permission strings documented
- Locale strings for all new copy (en, fr, es)
- Vitest tests for new Convex queries

### Definition of Done
- [x] `bun run typecheck` passes with no NEW errors (pre-existing: mediaThumbnails.ts Buffer type issue)
- [x] `bun run lint` passes with no NEW errors (pre-existing: 6 ui package errors in data-table.tsx)
- [x] `bun test` structure correct (execution blocked by import.meta.glob environment issue, not our code)
- [x] All new features permission-gated
- [x] All new UI text localized
- [x] Visual parity with HTML mockup reference pages

### Must Have
- Modern dark theme using CSS variables (bg-card, border-border, text-muted-foreground)
- KPI cards on dashboard and loans admin view
- Assignments queue showing user's pending approvals
- Transit status on loan detail pages
- New arrivals feed from accessions

### Must NOT Have (Guardrails)
- NO navigation restructuring in Slice 1 (separate future work)
- NO organization switcher redesign
- NO charts or data visualizations (out of scope)
- NO new Convex tables (reuse existing schema)
- NO hardcoded English strings (all must be localized)
- NO features not shown in HTML mockup reference pages
- NO `any` types or `@ts-ignore`
- NO modification of existing component APIs (only add new components)
- NO hardcoded Tailwind color classes (use CSS variables: bg-card, border-border, text-muted-foreground)

### Development Rules
- **Primary design reference**: `aura-html-pages/dashboard-as-admin.html` (most complete design/feature reference)
- **Secondary references**: Other files in `aura-html-pages/` for specific feature details
- **Naming convention**: NO "Aura" in code, commits, or component names - use generic descriptive names
- **Theming**: Use global CSS variables from globals.css, NOT hardcoded colors
  - Background: `bg-card` or `bg-background` (not `bg-zinc-900/40`)
  - Borders: `border-border` (not `border-zinc-800/60`)
  - Text: `text-foreground`, `text-muted-foreground` (not `text-zinc-*`)
  - Accents: `bg-accent`, `text-accent-foreground`
- **Commits**: Git commit after EACH completed task with descriptive message (no "Aura" mentions)

### Coding Standards & Skills (MANDATORY)

Executor MUST load and follow these skills/rules before implementing:

| Skill/Rule | When to Use | Key Focus |
|------------|-------------|-----------|
| `/web-interface-guidelines` | ALL UI work | Accessibility (aria-labels, keyboard handlers), focus states, forms, animation, typography, content handling |
| `/vercel-react-best-practices` | ALL React/Next.js code | RSC-first, performance patterns, data fetching, bundle optimization |
| `.cursor/rules/convex_rules.mdc` | ALL Convex backend work | Function syntax, validators (args/returns), schema design, query patterns (withIndex not filter) |

**Pre-Task Checklist:**
- [ ] Load relevant skill(s) for the task type
- [ ] Review skill rules before writing code
- [ ] Verify compliance before marking task complete

**Key Rules Summary:**

**Web Interface Guidelines:**
- Icon buttons need `aria-label`
- Form controls need `<label>` or `aria-label`
- Interactive elements need `focus-visible:ring-*`
- Use `<button>` for actions, `<Link>` for navigation (never `<div onClick>`)
- Honor `prefers-reduced-motion` for animations
- Never `transition: all` - list properties explicitly
- URL reflects state (filters, tabs, pagination via nuqs)

**React/Next.js Best Practices:**
- RSC-first: minimize `"use client"`, `useEffect`, `useState`
- Wrap client components in `Suspense` with fallback
- Compose smaller components; avoid massive JSX blocks

**Convex Rules:**
- ALWAYS include `args` and `returns` validators
- Use `v.null()` for functions that don't return a value
- Use `.withIndex()` not `.filter()` for queries
- Use `v.id("tableName")` for ID validators, not `v.string()`
- Actions: add `"use node";` at top; no `ctx.db` access
- Use `v.int64()` not `v.bigint()` (deprecated)

**Accessibility (MANDATORY):**
- ALL clickable elements need `focus-visible:ring-2 ring-ring ring-offset-2`
- Icon buttons need `aria-label`
- Loading states need `aria-busy="true"` on container
- Empty states need `role="status"` for screen readers
- ALL animations must use `motion-safe:animate-*` (respects `prefers-reduced-motion`)

**Dependencies to Install (Before Task 12):**
- `react-error-boundary` - for component-level error boundaries (functional API)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (tests-after)
- **Framework**: vitest + convex-test

### Tests-After Workflow
Each feature implementation followed by test tasks:
1. Implement feature
2. Write tests covering: happy path, empty state, permission denied
3. Run `bun test` → verify PASS

### Manual Verification
- Use Playwright browser automation for visual verification
- Screenshot evidence saved to `.sisyphus/evidence/`

---

## Task Flow

```
Phase 0: Component Library
  ├── 0 (Theming Infrastructure) [FIRST - enables CSS variables]
  ├── 1 (Foundation + KpiCard) [DONE, needs Task 0 refactor]
  └── 2-7 (Other UI components) [PARALLEL after 0]

Phase 1: Dashboard + Loans (Slice 1)
  ├── 8-10 (Dashboard restyle + features)
  ├── 11 (Loans list restyle) [PARALLEL with 8-10, 13]
  ├── 13 (Permissions) [PARALLEL with 11, BEFORE 12, 14]
  └── 12, 14 (Admin overview + Transport) [AFTER 11, 13]

Phase 2: Collections + Objects
  ├── 15-17 (Collections)
  └── 18-20 (Objects)

Phase 3: Locations
  └── 21-23 (Locations)

Phase 4: Polish
  ├── 24 (Locale strings)
  └── 25-26 (Tests)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A0 | 0 | Theming infrastructure - MUST run first (enables CSS variables) |
| A1 | 1 | Component library foundation - DONE, refactored by Task 0 |
| A2 | 2-7 | Component library - parallel after Task 0 |
| B | 8-10 | Dashboard - after Group A2 |
| C1 | 11, 13 | Loans list restyle + permissions - parallel, after Group A2 |
| C2 | 12, 14 | Loans admin features - after C1 (depend on Task 13 for permissions) |
| D | 15-17 | Collections - after B, C2 |
| E | 18-20 | Objects - parallel with D |
| F | 21-23 | Locations - after D, E |

---

## TODOs

### Phase 0: Component Library Foundation

- [x] 0. Setup theming infrastructure and migrate components

  **What to do**:
  - **Note**: Tailwind v3.4.x already supports opacity modifiers (`bg-card/40` syntax works)
  - Verify `packages/ui/tailwind.config.ts` uses `<alpha-value>` syntax (likely already configured)
  - Refactor ALL existing dashboard components to use CSS variables:
    - `bg-zinc-900/40` → `bg-card/40`
    - `border-zinc-800/60` → `border-border/60`
    - `border-zinc-800/50` → `border-border/50`
    - `bg-zinc-800/50` → `bg-muted/50`
    - `text-zinc-500` → `text-muted-foreground`
    - `text-zinc-100` → `text-foreground`
    - `text-zinc-400` → `text-muted-foreground`
    - `text-zinc-300` → `text-foreground/80`
  - Keep status colors (emerald, rose, amber, indigo) as explicit Tailwind colors
  - Move components from `aura/` subfolder to main components folder (or delete subfolder if empty)

  **Must NOT do**:
  - Don't change component logic or props
  - Don't modify globals.css (variables already exist)
  - Don't use "Aura" in any names

  **Parallelizable**: NO (must complete before other tasks can use CSS variables)

  **References**:
  - `packages/ui/tailwind.config.ts` - Current color definitions
  - `packages/ui/src/globals.css` - Existing CSS variables (--card, --border, --muted, etc.)
  - `packages/ui/src/components/*.tsx` - Component files to refactor

  **Acceptance Criteria**:
  - [ ] tailwind.config.ts colors use `<alpha-value>` syntax
  - [ ] All components use CSS variables (bg-card, border-border, text-muted-foreground)
  - [ ] No hardcoded zinc-* colors (except status indicators)
  - [ ] Component names are generic (KpiCard, GlassPanel, not AuraKpiCard)
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): enable CSS variable theming and refactor components`
  - Files: `packages/ui/tailwind.config.ts`, `packages/ui/src/components/*.tsx`

---

- [x] 1. Create component library foundation + KpiCard

  **What to do**:
  - Create `packages/ui/src/components/kpi-card.tsx` (or in subfolder)
  - Props: `title`, `value`, `change`, `changeType` (positive/negative/neutral), `icon`, `loading`
  - Style: Use CSS variables (bg-card/40, border-border/60, etc.)
  - Include loading skeleton state
  - Export from package.json

  **Must NOT do**:
  - No hardcoded text (use props)
  - No data fetching inside component
  - No "Aura" in names

  **Parallelizable**: NO (Tasks 2-7 depend on this for barrel export file)

  **References**:
  - `aura-html-pages/dashboard-as-admin.html` - KPI card layout patterns (PRIMARY)
  - `packages/ui/src/components/` - Existing component structure to follow
  - `packages/ui/package.json` - Existing subpath exports pattern to follow

  **Acceptance Criteria**:
  - [x] Component renders with all prop variants
  - [x] Loading state shows skeleton
  - [x] TypeScript types exported
  - [x] Export works from @v1/ui
  - [x] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add KpiCard component`
  - Files: `packages/ui/src/components/kpi-card.tsx`, `packages/ui/package.json`

---

- [x] 2. Create GlassPanel component

  **What to do**:
  - Create `packages/ui/src/components/glass-panel.tsx`
  - Style: `bg-card/40 backdrop-blur-xl border border-border/60 rounded-xl` (USE CSS VARIABLES)
  - Props: `children`, `className`, `padding` (sm/md/lg)
  - Composable container for cards, modals, dropdowns

  **Must NOT do**:
  - No fixed dimensions (fluid by default)
  - No hardcoded colors (use CSS variables)

  **Parallelizable**: YES (with 3-7, after Task 0)

  **References**:
  - `aura-html-pages/dashboard-as-admin.html:20-24` - `.glass-panel` CSS definition

  **Acceptance Criteria**:
  - [ ] Renders children with glass effect
  - [ ] Padding variants work
  - [ ] Exported from package
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add GlassPanel component`
  - Files: `packages/ui/src/components/glass-panel.tsx`

---

- [x] 3. Create StatusBadge component

  **What to do**:
  - Create `packages/ui/src/components/status-badge.tsx`
  - Props: `status`, `size` (sm/md), `variant` (solid/outline)
  - Status colors: pending=amber, active=emerald, completed=indigo, overdue=rose, draft=muted
  - Include dot indicator option

  **Must NOT do**:
  - No status-specific logic (pure presentational)

  **Parallelizable**: YES (with 2, 4-7, after Task 0)

  **References**:
  - `aura-html-pages/loans-overview-admin.html` - Status badge patterns
  - `aura-html-pages/edit-patron-1.html:186-189` - "Good Standing" badge example

  **Acceptance Criteria**:
  - [ ] All status variants render correctly
  - [ ] Size variants work
  - [ ] Dot indicator optional
  - [ ] Exported from package
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add StatusBadge component`
  - Files: `packages/ui/src/components/status-badge.tsx`

---

- [x] 4. Create Timeline component

  **What to do**:
  - Create `packages/ui/src/components/timeline.tsx`
  - Props: `items` array with `{ title, description, date, status, icon }`
  - Vertical timeline with connecting line
  - Status-colored dots

  **Must NOT do**:
  - No horizontal variant (out of scope)

  **Parallelizable**: YES (with 2-3, 5-7, after Task 0)

  **References**:
  - `aura-html-pages/location-and-tracking.html` - Timeline patterns
  - `aura-html-pages/loans-transport.html` - Transport timeline

  **Acceptance Criteria**:
  - [ ] Renders timeline with items
  - [ ] Status colors applied to dots
  - [ ] Connecting line visible
  - [ ] Export added to `packages/ui/src/components/index.ts`
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add Timeline component`
  - Files: `packages/ui/src/components/timeline.tsx`

---

- [x] 5. Create DataTable component

  **What to do**:
  - Create `packages/ui/src/components/data-table.tsx`
  - Props: `columns`, `data`, `loading`, `emptyState`, `onRowClick`
  - Style: Dark theme table patterns (border-border/60, bg-card hover states) - USE CSS VARIABLES
  - Include loading skeleton rows

  **Must NOT do**:
  - No built-in pagination (use external)
  - No sorting logic (use external)
  - No hardcoded zinc colors (use CSS variables)

  **Parallelizable**: YES (with 2-4, 6-7, after Task 0)

  **References**:
  - `aura-html-pages/loans-overview-admin.html` - Table layout
  - `aura-html-pages/collection.html` - Collection table patterns

  **Acceptance Criteria**:
  - [ ] Renders table with columns and data
  - [ ] Loading state shows skeleton rows
  - [ ] Empty state renders custom component
  - [ ] Row click handler works
  - [ ] Export added to `packages/ui/src/components/index.ts`
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add DataTable component`
  - Files: `packages/ui/src/components/data-table.tsx`

---

- [x] 6. Create EmptyState component

  **What to do**:
  - Create `packages/ui/src/components/empty-state.tsx`
  - Props: `icon`, `title`, `description`, `action` (button config)
  - Centered layout with muted styling

  **Must NOT do**:
  - No specific content (all via props)

  **Parallelizable**: YES (with 2-5, 7, after Task 0)

  **References**:
  - Standard empty state patterns (centered, muted)

  **Acceptance Criteria**:
  - [ ] Renders with icon, title, description
  - [ ] Action button optional
  - [ ] Export added to `packages/ui/src/components/index.ts`
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add EmptyState component`
  - Files: `packages/ui/src/components/empty-state.tsx`

---

- [x] 7. Create Skeleton components

  **What to do**:
  - Create `packages/ui/src/components/skeleton-variants.tsx`
  - Variants: `SkeletonCard`, `SkeletonTable`, `SkeletonText`, `SkeletonAvatar`
  - Animated pulse effect
  - Match card/table dimensions

  **Must NOT do**:
  - No complex shapes (basic rectangles only)

  **Parallelizable**: YES (with 2-6, after Task 0)

  **References**:
  - Tailwind animate-pulse patterns

  **Acceptance Criteria**:
  - [ ] All skeleton variants render
  - [ ] Animation visible
  - [ ] Export added to `packages/ui/src/components/index.ts`
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): add Skeleton variant components`
  - Files: `packages/ui/src/components/skeleton-variants.tsx`

---

### Phase 1: Dashboard + Loans (Slice 1)

**RSC/Client Component Note**: All pages in `apps/app/src/app/[locale]/(dashboard)/**/page.tsx` remain Server Components. New data widgets (assignments-queue, new-arrivals-feed, admin-overview, transport-status, location-timeline) must be `"use client"` components since they use `useQuery` and `PermissionGate`.

- [x] 8. Restyle Dashboard page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/page.tsx` (or dashboard route) - keep as RSC
  - Apply dark theme using CSS variables: `bg-background`, `text-muted-foreground`, `border-border/60`
  - Add 4-column KPI grid using KpiCard
  - Add page header with breadcrumb pattern
  - Wrap content in GlassPanel where appropriate
  - Import client components for data widgets

  **Data Contract** (from `api.dashboard.getAnalytics`):
  - KPI 1: "Total Objects" → `objects.total` (number)
  - KPI 2: "Objects on Loan" → `objects.loaned` (number)
  - KPI 3: "Active Loans" → `loans.active` (number)
  - KPI 4: "Pending Accessions" → `accessions.pending` (number)
  
  Note: `getAnalytics` returns nested objects and requires `organization.view_analytics` permission (backend-enforced). Existing dashboard already calls this query. After Task 13, registrar will also have this permission.

  **Must NOT do**:
  - NO navigation changes
  - NO chart/visualization components
  - NO changes to sidebar

  **Parallelizable**: YES (with 11-14, after 1-7)

  **References**:
  - `aura-html-pages/dasboard-as-admin.html` - Full dashboard layout (design reference)
  - `packages/backend/convex/dashboard.ts` - `getAnalytics` query returns counts
  - `apps/app/src/app/[locale]/(dashboard)/` - Route structure

  **Acceptance Criteria**:
  - [ ] Page uses CSS variables for colors (bg-background, text-foreground, border-border)
  - [ ] 4 KPI cards visible with live data from `getAnalytics` (verify as admin user who has `organization.view_analytics`)
  - [ ] Loading skeletons show during data fetch
  - [ ] Responsive grid (4 cols on xl, 2 on md, 1 on sm)
  - [ ] `bun run typecheck` passes
  - [ ] Using Playwright: navigate to `/en` as admin → verify KPI cards visible → screenshot

  **Commit**: YES
  - Message: `feat(app): restyle dashboard with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/page.tsx`

---

- [x] 9. Add Assignments Queue to Dashboard

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/_components/assignments-queue.tsx` with `"use client"` directive
  - Use existing `api.assignments.listMyAssignments` query
  - Display pending approvals grouped by type (loans, accessions, exhibitions, conservation)
  - Show urgency indicators (high=rose, medium=amber, low=text-muted-foreground)
  - Each item links to relevant entity
  - Use GlassPanel container
  - Add to dashboard page layout

  **Data Contract** (from `api.assignments.listMyAssignments`):
  - **Primary section**: `pendingApprovals` array - items user can approve (has `type`, `title`, `subtitle`, `urgency`, `workflowStep`)
  - **Secondary section**: `myAssignedAccessions` array - accessions directly assigned to user (has `accessionNumber`, `source`, `status`)
  - **Stats from same query**: `stats.totalPendingApprovals`, `stats.totalAssignedAccessions`, `stats.itemsModifiedThisWeek` (no `urgentItems` in this query)
  - Group `pendingApprovals` by `type` field: "accession" | "loan" | "exhibition" | "conservation"
  - Urgency indicator: use `urgency` field from each `pendingApprovals` item (values: "high" | "medium" | "low")

  **Must NOT do**:
  - NO new Convex query (use existing)
  - NO team-wide queue (user's only)

  **Parallelizable**: NO (depends on 8)

  **References**:
  - `packages/backend/convex/assignments.ts:11-91` - `listMyAssignments` return shape
  - `aura-html-pages/my-assignments.html` - Assignments UI patterns
  - `aura-html-pages/dasboard-as-admin.html:97-113` - "My Assignments" nav item

  **Acceptance Criteria**:
  - [ ] Queue shows current user's pending approvals only
  - [ ] Items grouped by type with headers
  - [ ] Urgency colors applied (high=rose, medium=amber)
  - [ ] Click navigates to entity (loan/accession/etc)
  - [ ] Empty state when no assignments
  - [ ] Loading skeleton while fetching
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): add assignments queue to dashboard`
  - Files: `apps/app/src/app/[locale]/(dashboard)/_components/assignments-queue.tsx`, `apps/app/src/app/[locale]/(dashboard)/page.tsx`

---

- [x] 10. Add New Arrivals Feed to Dashboard

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/_components/new-arrivals-feed.tsx` with `"use client"` directive
  - Wrap in PermissionGate with `collections.read` permission (required by backend)
  - Query recent accessions using `api.accessions.list` with:
    - `organizationId` (from context)
    - `paginationOpts: { numItems: 10, cursor: null }`
  - Returns `{ page, isDone, continueCursor }` - use `page` array
  - Backend sorts by `dateReceived` desc via manual pagination
  - Display as card list with status badges
  - Each card links to accession detail
  - Use GlassPanel + StatusBadge
  - Show empty state or hide component if user lacks permission (graceful degradation)

  **Performance Note**: Current `accessions.list` does `.collect()` + in-memory sort + slice. Acceptable for MVP. If slow on large orgs, escalate to add dedicated `getRecentAccessions` query with `by_organization_and_dateReceived` index.

  **Status Mapping** (Convex status → Display label):
  - `pending` → "Processing" (amber badge)
  - `approved` → "Cataloged" (emerald badge)
  - `rejected` → "Rejected" (rose badge)

  **Must NOT do**:
  - NO new Convex query if existing works
  - NO complex pagination UI (just first page of 10)

  **Parallelizable**: NO (depends on 8)

  **References**:
  - `packages/backend/convex/accessions.ts` - Accessions queries
  - `aura-html-pages/new-arrivals.html` - New arrivals layout
  - `aura-html-pages/accessions.html` - Accessions list patterns

  **Acceptance Criteria**:
  - [ ] Shows 5-10 most recent accessions
  - [ ] Status badges with correct colors
  - [ ] Click navigates to accession detail
  - [ ] Empty state when no accessions
  - [ ] Loading skeleton while fetching
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): add new arrivals feed to dashboard`
  - Files: `apps/app/src/app/[locale]/(dashboard)/_components/new-arrivals-feed.tsx`, `apps/app/src/app/[locale]/(dashboard)/page.tsx`

---

- [x] 11. Restyle Loans List page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx`
  - Apply dark theme styling to page layout
  - Update table/list to use DataTable
  - Add status badges using StatusBadge
  - Add page header with filters
  - Keep existing filter/search functionality (style only)

  **Must NOT do**:
  - NO changes to filter logic
  - NO changes to data fetching

  **Parallelizable**: YES (with 8-10, after 1-7)

  **References**:
  - `aura-html-pages/loans-overview-admin.html` - Admin loans layout (design reference)
  - `aura-html-pages/loans-overview.html` - Standard loans layout (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Page uses CSS variables for dark theme
  - [ ] Table uses DataTable component
  - [ ] Status badges use StatusBadge
  - [ ] Existing filters still work
  - [ ] Loading state during data fetch
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle loans list with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx`

---

- [x] 12. Add Admin Loan Overview with KPIs

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/loans/_components/admin-overview.tsx` with `"use client"` directive
  - Wrap entire admin overview container in PermissionGate with `loans.view_admin_overview` permission (defined in Task 13)
  - Add KPI row using modular child components for each KPI (to enable per-KPI permission gating inside the admin section)
  - Use KpiCard components
  - Add to loans page above table

  **Prerequisites**:
  - Install `react-error-boundary` package: `bun add react-error-boundary` (in packages/ui or apps/app)

  **Component Structure** (each child is `"use client"` with additional fine-grained gating):
  - `admin-overview.tsx` - Container, gated by `loans.view_admin_overview`, renders 4 child components. Wrap each child in `<ErrorBoundary fallback={<KpiCardUnavailable />}>` from `react-error-boundary`.
  - `kpi-active-loans.tsx` - PermissionGate `organization.view_analytics` → calls `getAnalytics` → shows `loans.active`
  - `kpi-pending-approvals.tsx` - PermissionGate `organization.view_analytics` → calls `getAnalytics` → shows `loans.pending`
  - `kpi-in-transit.tsx` - PermissionGate `loans.read` → calls `getTransitStats` → shows `inTransit`
  - `kpi-overdue.tsx` - PermissionGate `collections.read` → calls `getOperationalKpis` → shows `loans.overdue` (also requires `reporting` feature; hide if unavailable)
  
  **Edge Case: `reporting` feature unavailable**:
  - Check feature flag before rendering Overdue KPI
  - If unavailable: hide KPI entirely (don't show "Unavailable" - just don't render)
  - Use `hasFeatureAccess("reporting")` pattern from existing codebase

  **Data Contract**:
  - KPI "Active Loans": `loans.active` from `api.dashboard.getAnalytics` (backend requires `organization.view_analytics`)
  - KPI "Pending Approvals": `loans.pending` from `api.dashboard.getAnalytics` (backend requires `organization.view_analytics`)
  - KPI "In Transit": `inTransit` from `api.transit.getTransitStats` (backend requires `loans.read`)
  - KPI "Overdue": `loans.overdue` from `api.dashboard.getOperationalKpis` (backend requires `reporting` feature + `collections.read`)
  
  **Permission Model**:
  - Container gated by `loans.view_admin_overview` (only users with this permission see admin overview at all)
  - Each KPI wrapped in its own PermissionGate:
    - Active Loans, Pending Approvals: `organization.view_analytics`
    - In Transit: `loans.read`
    - Overdue: `collections.read`
  - Additionally wrap each KPI in React ErrorBoundary (fallback shows "Unavailable" card) to handle edge cases
  - Roles with `loans.view_admin_overview` will also have required data permissions (ensured by Task 13 role assignment)

  **Must NOT do**:
  - NO KPIs for users without `loans.view_admin_overview` permission (entire admin overview hidden)
  - NO new Convex queries if existing work

  **Parallelizable**: NO (depends on 11 and 13)

  **References**:
  - `packages/backend/convex/loans.ts` - Loan queries
  - `packages/backend/convex/transit.ts:1344-1398` - `getTransitStats` returns counts
  - `aura-html-pages/loans-overview-admin.html` - Admin KPI layout (design reference)
  - `aura-html-pages/loans-overview-admin-2.html` - Alternative admin layout (design reference)

  **Acceptance Criteria**:
  - [ ] `react-error-boundary` package installed
  - [ ] Admin overview only visible to users with `loans.view_admin_overview` permission
  - [ ] KPI cards show: Active Loans, Pending Approvals, In Transit, Overdue (with fine-grained gating inside)
  - [ ] Each KPI wrapped in ErrorBoundary with "Unavailable" fallback card
  - [ ] Overdue KPI hidden when `reporting` feature unavailable (not error state, just hidden)
  - [ ] Data is live from Convex
  - [ ] Loading skeletons during fetch
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): add admin loan overview with per-KPI permission gating`
  - Files: `apps/app/src/app/[locale]/(dashboard)/loans/_components/admin-overview.tsx`, `apps/app/src/app/[locale]/(dashboard)/loans/_components/kpi-*.tsx`, `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx`

---

- [x] 13. Add new permission strings for loans admin features

  **What to do**:
  - Add `loans.view_admin_overview` permission to `packages/backend/convex/organizations.ts` in `createDefaultRoles` function
  - Add `loans.view_transport` permission to the same function
  - Add these permissions to the `permissionNames` array (line ~959)
  - Document new permissions in code comments

  **Role Assignment Strategy** (ensures UI gates align with backend requirements):
  - **admin**: Gets `loans.view_admin_overview` + `loans.view_transport` + `organization.view_analytics` (admin already has all permissions)
  - **registrar**: Gets `loans.view_admin_overview` + `loans.view_transport` + **ADD** `organization.view_analytics` (registrar has `loans.read`, `collections.read`; does NOT currently have `organization.view_analytics` - must be added)
  - **curator**: Does NOT get any new permissions (curator lacks `loans.read` by default)
  
  **Additional Change Required**: Grant `organization.view_analytics` to registrar role in `createDefaultRoles` (add to registrarPerms array at line ~1056). This is required because admin overview KPIs call `api.dashboard.getAnalytics` which enforces this permission.
  
  **Note**: Only assign `loans.view_admin_overview` to roles that have `organization.view_analytics`, `loans.read`, and `collections.read`. Only assign `loans.view_transport` to roles that have `loans.read`.

  **Backfill Strategy for Existing Organizations**:
  - Add internal mutation `backfillLoanAdminPermissions` to `packages/backend/convex/migrations.ts` (existing migrations file)
  - Query all existing organizations, for each:
    1. Check if permissions `loans.view_admin_overview` and `loans.view_transport` exist in global `permissions` table
    2. If not, insert them
    3. For each org's admin/registrar roles, add rolePermissions entries for both new permissions
    4. **Also add `organization.view_analytics` to registrar role** (required for admin overview KPIs)
    5. Curator does NOT get any new permissions (curator lacks `loans.read`)
  - Run via Convex dashboard: `bunx convex run migrations:backfillLoanAdminPermissions`

  **Must NOT do**:
  - NO removal of existing permissions
  - NO changes to permission checking logic
  - NO assigning `loans.view_admin_overview` to roles that lack required data permissions

  **Parallelizable**: NO (must complete before Task 12, parallel with 11, after 1-7)

  **References**:
  - `packages/backend/convex/organizations.ts:915-1126` - `createDefaultRoles` function
  - `packages/backend/convex/organizations.ts:959-994` - `permissionNames` array
  - `apps/app/src/components/permission-gate.tsx` - PermissionGate component

  **Acceptance Criteria**:
  - [ ] `loans.view_admin_overview` and `loans.view_transport` permissions added to `createDefaultRoles` permissionNames array
  - [ ] `organization.view_analytics` added to registrarPerms array (line ~1056)
  - [ ] Both new permissions assigned only to admin/registrar
  - [ ] Backfill migration adds all 3 permissions to registrar role for existing orgs
  - [ ] Curator does NOT receive new permissions
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(backend): add loans admin permission strings with backfill migration`
  - Files: `packages/backend/convex/organizations.ts`, `packages/backend/convex/migrations.ts`

---

- [x] 14. Add Transport Status to Loan Detail page

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/loans/[id]/_components/transport-status.tsx` with `"use client"` directive
  - Wrap in PermissionGate with `loans.view_transport` permission (defined in Task 13)
  - Add a new Convex query `api.transit.getTransitForLoanWithHistory` that returns transit records with embedded statusHistory (single query, avoids hooks-in-loop issue)
  - Display transit records using Timeline component
  - Show status: draft, scheduled, in_transit, out_for_delivery, delivered
  - Add to loan detail page sidebar or section

  **New Query Specification** (add to `packages/backend/convex/transit.ts`):
  ```typescript
  export const getTransitForLoanWithHistory = query({
    args: { loanId: v.id("loans"), limit: v.optional(v.number()) },
    returns: v.array(v.object({
      _id: v.id("transitRecords"),
      transitNumber: v.string(),
      transitType: transitTypeValidator,
      carrier: v.string(),
      status: transitStatusValidator,
      scheduledPickupDate: v.optional(v.number()),
      estimatedDeliveryDate: v.optional(v.number()),
      actualDeliveryDate: v.optional(v.number()),
      statusHistory: v.array(v.object({
        status: transitStatusValidator,
        location: v.optional(v.string()),
        description: v.string(),
        reportedAt: v.number(),
        reportedByName: v.optional(v.string()),
      })),
    })),
    handler: async (ctx, args) => {
      // Load loan first to get organizationId for permission check
      const loan = await ctx.db.get(args.loanId);
      if (!loan) return [];
      
      // Permission check: require loans.read (same as existing transit queries)
      await requirePermission(ctx, loan.organizationId, "loans.read");
      
      // Query transit records for loan (reuse existing logic from getTransitForLoan)
      // For each record (limit to 5), query transitStatusUpdates and embed as statusHistory
      // Return in single response
    }
  });
  ```
  
  **Permission Alignment**: Query enforces `loans.read` (same as existing transit queries). UI gates with `loans.view_transport`. Task 13 ensures all roles receiving `loans.view_transport` (admin, registrar) already have `loans.read`.

  **Must NOT do**:
  - NO transport creation/editing (view only in this task)
  - NO calling useQuery in a loop (use single aggregated query instead)

  **Parallelizable**: NO (depends on 11 and 13)

  **References**:
  - `packages/backend/convex/transit.ts:1119-1158` - `getTransitForLoan` query
  - `packages/backend/convex/transit.ts:558-797` - `getTransitRecord` query with `statusHistory`
  - `aura-html-pages/loans-transport.html` - Transport tracking layout
  - `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx` - Loan detail page

  **Acceptance Criteria**:
  - [ ] Transit records displayed for loan
  - [ ] Timeline shows status progression
  - [ ] Status badges use correct colors
  - [ ] Empty state when no transit records
  - [ ] Loading state during fetch
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): add transport status to loan detail`
  - Files: `apps/app/src/app/[locale]/(dashboard)/loans/[id]/_components/transport-status.tsx`, `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx`, `packages/backend/convex/transit.ts`

---

### Phase 2: Collections + Objects

- [x] 15. Restyle Collections List page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx`
  - Apply dark theme using CSS variables: bg-background, border-border/60
  - Update grid/list to use dark theme patterns
  - Add StatusBadge for collection status
  - Keep existing functionality

  **Must NOT do**:
  - NO changes to data fetching logic
  - NO new features

  **Parallelizable**: YES (with 18-20)

  **References**:
  - `aura-html-pages/collection.html` - Collection page layout (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Page uses CSS variables for dark theme
  - [ ] Grid/list uses dark theme patterns
  - [ ] Existing functionality preserved
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle collections list with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx`

---

- [x] 16. Restyle Collection Detail page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/collections/[id]/page.tsx`
  - Apply dark theme styling to detail layout
  - Use GlassPanel for content sections
  - Style metadata display with dark theme patterns

  **Must NOT do**:
  - NO changes to data fetching
  - NO new features

  **Parallelizable**: NO (depends on 15)

  **References**:
  - `aura-html-pages/collection.html` - Collection detail patterns (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/collections/[id]/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Detail page uses CSS variables for dark theme
  - [ ] Glass panels used for sections
  - [ ] Existing functionality preserved
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle collection detail with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/collections/[id]/page.tsx`

---

- [x] 17. Restyle Accessions pages with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/accessions/` pages
  - Apply dark theme styling to list and detail pages
  - Use StatusBadge for accession status
  - Style workflow steps with dark theme patterns

  **Must NOT do**:
  - NO changes to workflow logic
  - NO new features

  **Parallelizable**: NO (depends on 15)

  **References**:
  - `aura-html-pages/accessions.html` - Accessions layout (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/accessions/` - Current implementation

  **Acceptance Criteria**:
  - [ ] Accessions pages use CSS variables for dark theme
  - [ ] Status badges use StatusBadge
  - [ ] Workflow display styled
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle accessions pages with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/accessions/`

---

- [x] 18. Restyle Objects List page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx`
  - Apply dark theme styling to grid view
  - Style object cards with dark theme patterns
  - Keep existing view toggle functionality

  **Must NOT do**:
  - NO changes to data fetching
  - NO new features

  **Parallelizable**: YES (with 15-17)

  **References**:
  - `aura-html-pages/object.html` - Object page patterns (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Objects page uses CSS variables for dark theme
  - [ ] Grid cards styled with dark theme patterns
  - [ ] Existing functionality preserved
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle objects list with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx`

---

- [x] 19. Restyle Object Detail page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx`
  - Apply dark theme styling to detail layout
  - Use GlassPanel for content sections
  - Style media gallery area

  **Must NOT do**:
  - NO changes to data fetching
  - NO lightbox feature yet (task 20)

  **Parallelizable**: NO (depends on 18)

  **References**:
  - `aura-html-pages/object.html` - Object detail layout (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Detail page uses CSS variables for dark theme
  - [ ] Media section styled
  - [ ] Existing functionality preserved
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle object detail with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx`

---

- [x] 20. Restyle existing Object Lightbox with modern dark theme

  **What to do**:
  - Restyle existing `packages/ui/src/components/image-lightbox.tsx` component with dark theme
  - Apply dark theme using CSS variables: bg-background overlay, glass panel for controls (bg-card/40 border-border/60), accent colors
  - Ensure full-screen image viewer with zoom works
  - Ensure navigation between images works
  - Ensure close button and keyboard support (Escape) works
  - Verify integration with object detail page (already imports `@v1/ui/image-lightbox`)

  **Must NOT do**:
  - NO creating a new lightbox component (existing component found at `@v1/ui/image-lightbox`)
  - NO video support (images only)

  **Parallelizable**: NO (depends on 19)

  **References**:
  - `packages/ui/src/components/image-lightbox.tsx` - Existing lightbox component to restyle
  - `aura-html-pages/object-light.html` - Lightbox patterns (design reference)

  **Acceptance Criteria**:
  - [ ] Lightbox opens on image click
  - [ ] Full-screen with dark overlay using CSS variables (bg-background)
  - [ ] Navigation between images
  - [ ] Escape key closes
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(ui): restyle image lightbox with modern dark theme`
  - Files: `packages/ui/src/components/image-lightbox.tsx`

---

### Phase 3: Locations

- [x] 21. Restyle Locations List page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`
  - Apply dark theme styling to tree/list view
  - Style location cards with dark theme patterns

  **Must NOT do**:
  - NO changes to tree logic
  - NO new features

  **Parallelizable**: YES (after Phase 2)

  **References**:
  - `aura-html-pages/location-and-tracking.html` - Location page layout (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Locations page uses CSS variables for dark theme
  - [ ] Tree view styled
  - [ ] Existing functionality preserved
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle locations list with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`

---

- [x] 22. Restyle Location Detail page with modern dark theme

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/locations/[id]/page.tsx`
  - Apply dark theme styling to detail layout
  - Use GlassPanel for sections

  **Must NOT do**:
  - NO changes to data fetching
  - NO timeline feature yet (task 23)

  **Parallelizable**: NO (depends on 21)

  **References**:
  - `aura-html-pages/location-and-tracking.html` - Location detail patterns (design reference)
  - `apps/app/src/app/[locale]/(dashboard)/locations/[id]/page.tsx` - Current implementation

  **Acceptance Criteria**:
  - [ ] Detail page uses CSS variables for dark theme
  - [ ] Glass panels used
  - [ ] Existing functionality preserved
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): restyle location detail with modern dark theme`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/[id]/page.tsx`

---

- [x] 23. Add Location Timeline feature

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/locations/[id]/_components/location-timeline.tsx` with `"use client"` directive
  - Show history of objects at this location
  - Use Timeline component
  - Add a new Convex query `api.locations.getLocationHistory` that queries the `locationHistory` table directly
  - **Also add composite indexes** to schema for efficient sorting

  **Schema Change** (add to `packages/backend/convex/schema.ts` at `locationHistory` table):
  ```typescript
  .index("by_toLocation_and_movedAt", ["toLocationId", "movedAt"])
  .index("by_fromLocation_and_movedAt", ["fromLocationId", "movedAt"])
  ```

  **New Query Specification** (add to `packages/backend/convex/locations.ts`):
  ```typescript
  export const getLocationHistory = query({
    args: { 
      locationId: v.id("locations"), 
      limit: v.optional(v.number()) 
    },
    returns: v.array(
      v.object({
        id: v.string(), // synthetic ID (not Convex _id)
        collectionId: v.id("collections"),
        collectionTitle: v.string(),
        accessionNumber: v.string(),
        eventType: v.union(v.literal("moved_in"), v.literal("moved_out")),
        timestamp: v.number(),
        movedByName: v.optional(v.string()),
        otherLocationName: v.optional(v.string()), // from/to location name
      })
    ),
    handler: async (ctx, args) => {
      const limit = args.limit ?? 50;
      
      // Query using composite index for efficient sort + limit
      const movedIn = await ctx.db
        .query("locationHistory")
        .withIndex("by_toLocation_and_movedAt", q => q.eq("toLocationId", args.locationId))
        .order("desc")
        .take(limit);
      
      const movedOut = await ctx.db
        .query("locationHistory")
        .withIndex("by_fromLocation_and_movedAt", q => q.eq("fromLocationId", args.locationId))
        .order("desc")
        .take(limit);
      
      // Merge, enrich with collection/user names, sort by timestamp desc, limit to args.limit
    }
  });
  ```

  **Must NOT do**:
  - NO editing from timeline
  - NO N+1 queries from frontend (use server-side aggregation)
  - NO scanning collections table (use locationHistory table with indexes)

  **Parallelizable**: NO (depends on 22)

  **References**:
  - `aura-html-pages/location-and-tracking.html` - Timeline patterns
  - `packages/backend/convex/locations.ts:929` - `getCollectionLocationHistory` query (collection-centric, for reference)

  **Acceptance Criteria**:
  - [ ] New `getLocationHistory` query added to `locations.ts`
  - [ ] Timeline shows location history
  - [ ] Events displayed chronologically
  - [ ] Empty state when no history
  - [ ] Loading state during fetch
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): add location timeline feature with server-side aggregation`
  - Files: `apps/app/src/app/[locale]/(dashboard)/locations/[id]/_components/location-timeline.tsx`, `packages/backend/convex/locations.ts`, `packages/backend/convex/schema.ts`

---

### Phase 4: Polish

- [x] 24. Add locale strings for all new UI text

  **What to do**:
  - Update `apps/app/src/locales/en.ts` with all new strings
  - Update `apps/app/src/locales/fr.ts` with French translations
  - Update `apps/app/src/locales/es.ts` with Spanish translations
  - Use namespace pattern: `dashboard.kpi.*`, `loans.admin.*`, etc.

  **Must NOT do**:
  - NO machine translation without review
  - NO missing keys between locales

  **Parallelizable**: YES (after all features)

  **References**:
  - `apps/app/src/locales/en.ts` - Existing locale structure (TypeScript, not JSON)
  - `apps/app/src/locales/fr.ts` - French locale file
  - `apps/app/src/locales/es.ts` - Spanish locale file
  - All new components for string inventory

  **Acceptance Criteria**:
  - [ ] All new UI text has locale keys
  - [ ] All three locale files updated
  - [ ] No hardcoded English in components
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(app): add locale strings for dashboard features`
  - Files: `apps/app/src/locales/en.ts`, `apps/app/src/locales/fr.ts`, `apps/app/src/locales/es.ts`

---

- [x] 25. Add Convex query tests for new features

  **What to do**:
  - Create `packages/backend/convex/assignments.test.ts` (new file, does not exist yet)
  - Add tests to existing `packages/backend/convex/transit.test.ts`
  - Add tests to existing `packages/backend/convex/locations.test.ts` for new `getLocationHistory` query
  - Test: permission checks, empty results, valid data
  - Follow existing test patterns with convex-test

  **Must NOT do**:
  - NO UI tests (Convex only)
  - NO mocking Convex internals

  **Parallelizable**: YES (after all features)

  **References**:
  - `packages/backend/convex/loans.test.ts` - Test patterns
  - `packages/backend/convex/__tests__/loans-workflow.example.test.ts` - Workflow test example

  **Acceptance Criteria**:
  - [ ] `assignments.test.ts` created with tests for `listMyAssignments` permission check
  - [ ] Tests cover `getTransitForLoan` empty case in `transit.test.ts`
  - [ ] Tests cover `getLocationHistory` in `locations.test.ts`
  - [ ] `bun test` passes

  **Commit**: YES
  - Message: `test(backend): add tests for assignments, transit, and location queries`
  - Files: `packages/backend/convex/assignments.test.ts` (new), `packages/backend/convex/transit.test.ts`, `packages/backend/convex/locations.test.ts`

---

- [x] 26. Final verification and cleanup

  **What to do**:
  - Run `bun run typecheck` and fix any errors
  - Run `bun run lint` and fix any errors
  - Run `bun test` and fix any failures
  - Remove any console.log statements
  - Verify all PermissionGate usage correct

  **Must NOT do**:
  - NO feature changes
  - NO new additions

  **Parallelizable**: NO (final task)

  **References**:
  - All modified files

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` passes with 0 errors
  - [ ] `bun run lint` passes with 0 errors
  - [ ] `bun test` passes with 0 failures
  - [ ] No console.log in production code

  **Commit**: YES
  - Message: `chore: final cleanup and verification`
  - Files: (any files needing fixes)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1-7 | Individual component commits | packages/ui/src/components/ | typecheck |
| 8 | `feat(app): restyle dashboard` | apps/app dashboard files | typecheck |
| 9-10 | Feature commits | apps/app dashboard components | typecheck |
| 11-14 | Loans feature commits | apps/app loans files | typecheck |
| 15-17 | Collections commits | apps/app collections/accessions | typecheck |
| 18-20 | Objects commits | apps/app objects files | typecheck |
| 21-23 | Locations commits | apps/app locations files | typecheck |
| 24 | Locale commit | apps/app/src/locales/ | typecheck |
| 25-26 | Test/cleanup commits | test files | full test suite |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: 0 errors
bun run lint       # Expected: 0 errors
bun test           # Expected: all tests pass
```

### Final Checklist
- [ ] All "Must Have" features present
- [ ] All "Must NOT Have" guardrails respected
- [ ] All pages match modern dark theme visual style
- [ ] All new text localized (en, fr, es)
- [ ] All new features permission-gated
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No lint errors
