# Design Adaptation v2 - Full App-Wide Redesign

## Context

### Original Request

Complete full app-wide UI redesign to match `museumlite-app-design.html` 1:1 across all 68 pages. This is v2, building on the foundation established in `design-adaptation.md` (KPI cards, hover buttons, activity badges).

### Interview Summary

**Key Discussions**:
- **Scope**: All 68 pages, including Library module
- **Sidebar**: Restructure navigation groups to match design exactly (Core Inventory, Collection Management, Operations, Library, Settings)
- **Components**: Create reusable components for complex patterns (location tree, rack visualization, timeline)
- **CSS**: Use CSS variables only - no hardcoded zinc values except print dialogs

**Research Findings**:
- 68 page.tsx files (corrected from initial 67)
- 28 loading.tsx files (corrected from initial 32)
- 99 hardcoded zinc occurrences in 18 files
- CSS variables and utilities already established in globals.css
- Sidebar configurable via JS arrays in `app-sidebar.tsx`

### Metis Review

**Identified Gaps** (addressed):
1. Design completeness → ACCEPT: Style only pages that exist; don't create new ones
2. Print dialogs → EXEMPT: Keep light zinc colors for printing
3. Light theme → DEFAULT: "Functional" not pixel-perfect
4. Responsive → PRESERVE: Existing patterns must not break
5. Component APIs → FREEZE: No prop interface changes

**Guardrails Applied**:
- NO hardcoded zinc values (except print dialogs)
- NO new pages (Transit Log, Installations, etc. out of scope)
- NO component prop interface changes
- NO new CSS animations (use existing utilities)
- NO i18n key changes
- NO settings pages (pre-existing errors)
- NO backend/Convex changes
- NO new npm dependencies
- Preserve dark/light theme switching
- Preserve accessibility attributes

---

## Work Objectives

### Core Objective

Visually align all 68 app pages with `museumlite-app-design.html` using CSS variables, while restructuring sidebar navigation to match design groups.

### Concrete Deliverables

1. Restructured sidebar with design navigation groups
2. New reusable components: LocationTree, RackVisualization, TimelineView
3. All zinc-* values migrated to CSS variables (99 occurrences in 18 files)
4. All pages styled to match design patterns
5. Consistent loading/empty/error states

### Definition of Done

- [ ] `ast_grep_search` for `zinc-` returns zero matches (excluding print dialogs)
- [ ] `bun run typecheck` passes (pre-existing settings errors acceptable)
- [ ] `bun run lint` passes
- [ ] Theme switcher: dark→light→system toggles without crashes
- [ ] All pages load without console errors

### Must Have

- Sidebar navigation matching design groups
- CSS variable-based theming throughout
- Reusable components for complex patterns
- All 68 pages styled consistently

### Must NOT Have (Guardrails)

- Hardcoded zinc values (except print dialogs marked with `[PRINT-EXEMPT]`)
- New pages that don't exist (Transit Log, Installations, etc.)
- Component prop interface changes
- New CSS animations
- New npm dependencies
- Backend/Convex changes
- Settings page changes
- i18n key changes
- Icon changes (unless design specifies)

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (typecheck, lint, browser)
- **User wants tests**: Manual verification
- **Framework**: Browser-based visual verification + automated checks

### Manual QA Protocol

Each TODO includes:
- `ast_grep_search` check for zinc values in modified files
- `bun run typecheck` and `bun run lint`
- Browser verification in both dark and light themes

---

## Task Flow

```
Milestone 1: Foundation
├── Task 1.1: Audit zinc occurrences → creates migration map
├── Task 1.2: Sidebar restructure → enables navigation
├── Task 1.3: LocationTree component → used by locations pages
├── Task 1.4: RackVisualization component → used by locations pages
└── Task 1.5: TimelineView component → used by exhibitions

Milestone 2: Core Pages (builds on v1)
├── Task 2.1: Objects list/detail pages
├── Task 2.2: Collections pages
└── Task 2.3: Media/Digital Assets pages

Milestone 3: Management Pages
├── Task 3.1: Accessions (kanban refinements)
├── Task 3.2: Deaccessions (table view)
├── Task 3.3: Locations pages (using new components)
└── Task 3.4: Loans pages

Milestone 4: Feature Pages
├── Task 4.1: Exhibitions pages
├── Task 4.2: Conservation pages
└── Task 4.3: Insurance pages

Milestone 5: Library Module
├── Task 5.1: Library Catalog
├── Task 5.2: Circulation
├── Task 5.3: Patrons
├── Task 5.4: Fines
└── Task 5.5: Acquisitions

Milestone 6: Final Polish
├── Task 6.1: Loading states (28 files)
├── Task 6.2: Empty states
├── Task 6.3: Error states
└── Task 6.4: Final verification
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1.3, 1.4, 1.5 | Independent component creation |
| B | 2.1, 2.2, 2.3 | Independent page groups |
| C | 3.1, 3.2 | Accessions/Deaccessions independent |
| D | 4.1, 4.2, 4.3 | Feature pages independent |
| E | 5.1-5.5 | Library pages independent |

| Task | Depends On | Reason |
|------|------------|--------|
| 1.2 | 1.1 | Need zinc audit before sidebar changes |
| 2.* | 1.2 | Need sidebar structure in place |
| 3.3 | 1.3, 1.4 | Locations needs new components |
| 4.1 | 1.5 | Exhibitions needs TimelineView |
| 6.* | All previous | Final polish after all pages |

---

## TODOs

---

### Milestone 1: Foundation

---

### - [x] 1.1 Audit Zinc Occurrences and Create Migration Map

**What to do**:
- Run `ast_grep_search` for all zinc-* patterns across codebase
- Document each occurrence with file path, line number, and replacement CSS variable
- Identify and mark print dialogs as `[PRINT-EXEMPT]`
- Create zinc-to-variable mapping table in this plan

**Expected Zinc → Variable Mapping**:
| Zinc Class | CSS Variable | Example |
|------------|--------------|---------|
| `bg-zinc-950` | `bg-background` | Page backgrounds |
| `bg-zinc-900` | `bg-card` | Card backgrounds |
| `bg-zinc-900/40` | `bg-card/70` or `glass-panel` | Transparent cards |
| `bg-zinc-800` | `bg-muted` | Muted backgrounds |
| `border-zinc-800` | `border-border` | Borders |
| `border-zinc-700` | `border-border` | Borders |
| `text-zinc-400` | `text-muted-foreground` | Secondary text |
| `text-zinc-300` | `text-muted-foreground` | Secondary text |
| `text-zinc-200` | `text-foreground` | Primary text |
| `text-zinc-100` | `text-foreground` | Primary text |
| `bg-zinc-500` | `bg-slate-500` | Neutral indicators |

**Must NOT do**:
- Don't modify any files in this task (audit only)
- Don't include zinc values in print dialogs as "must fix"

**Parallelizable**: NO (foundation for all other tasks)

**References**:

**Pattern References**:
- `packages/ui/src/globals.css:73-216` - Complete CSS variable definitions
- `.sisyphus/plans/design-adaptation.md:553-567` - Previous zinc fixes (zinc-500 → slate-500)

**Expected Files** (from Metis analysis):
- `apps/app/src/app/[locale]/(dashboard)/locations/*.tsx` (8 files, 60+ occurrences)
- `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx` (print dialogs)
- `apps/app/src/app/[locale]/(dashboard)/conservation/*.tsx`
- `apps/app/src/app/[locale]/(dashboard)/exhibitions/*.tsx`

**Acceptance Criteria**:
- [ ] Full zinc audit document created (file, line, pattern, replacement)
- [ ] Print dialogs identified and marked as exempt
- [ ] Migration map table completed
- [ ] All 99 occurrences accounted for

**Commit**: NO (audit only, no file changes)

---

### - [x] 1.2 Restructure Sidebar Navigation Groups

**What to do**:
- Modify `apps/app/src/components/app-sidebar.tsx` to use design navigation groups
- Update `sidebarItems` array structure to match design:
  - **Core Inventory**: Objects, Collections, Media
  - **Collection Management**: Accessions, Deaccessions, Locations
  - **Operations**: Loans, Exhibitions, Conservation
  - **Library**: Catalog, Circulation, Patrons, Fines, Acquisitions
  - **Administration**: (link to settings, not expanded)
- Preserve existing NavItem component styling
- Maintain existing icons and routes (just reorganize)

**Must NOT do**:
- Don't create new routes/pages
- Don't change NavItem component
- Don't remove any existing navigation items
- Don't change icons
- Don't change i18n keys

**Parallelizable**: NO (depends on 1.1)

**References**:

**Pattern References**:
- `apps/app/src/components/app-sidebar.tsx:127-201` - Current sidebar structure with `navMain` items
- `apps/app/src/components/app-sidebar.tsx:42-68` - NavItem component (DO NOT MODIFY)

**Design References**:
- `museumlite-app-design.html:200-320` - Sidebar navigation structure with group labels

**Acceptance Criteria**:
- [ ] Sidebar shows 5 groups: Core Inventory, Collection Management, Operations, Library, Administration
- [ ] All existing navigation items preserved (just regrouped)
- [ ] `bun run typecheck` passes
- [ ] Sidebar renders correctly in browser
- [ ] No TypeScript errors in `app-sidebar.tsx`

**Commit**: YES
- Message: `refactor(sidebar): restructure navigation groups to match design`
- Files: `apps/app/src/components/app-sidebar.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 1.3 Create LocationTree Component

**What to do**:
- Create `packages/ui/src/components/location-tree.tsx`
- Implement expandable tree structure for building/floor/room hierarchy
- Support selection state with callback
- Use existing CSS variables for styling
- Follow design patterns from `museumlite-app-design.html`

**Component API**:
```tsx
interface LocationTreeProps {
  locations: LocationNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

interface LocationNode {
  id: string;
  name: string;
  type: 'building' | 'floor' | 'room' | 'shelf';
  children?: LocationNode[];
  count?: number; // item count
}
```

**Must NOT do**:
- Don't use hardcoded zinc values
- Don't add new dependencies
- Don't create complex state management (keep it simple)

**Parallelizable**: YES (with 1.4, 1.5)

**References**:

**Pattern References**:
- `packages/ui/src/components/accordion.tsx` - Expandable pattern to follow
- `packages/ui/src/components/tree-view.tsx` - If exists, use as base

**Design References**:
- `museumlite-app-design.html:1900-2050` - Location tree sidebar design

**Acceptance Criteria**:
- [ ] Component renders tree structure with expand/collapse
- [ ] Selection state works with callback
- [ ] Uses CSS variables only (no zinc)
- [ ] `bun run typecheck` passes on new component
- [ ] Exported from `packages/ui/src/components/index.ts`

**Commit**: YES
- Message: `feat(ui): add LocationTree component for location hierarchy`
- Files: `packages/ui/src/components/location-tree.tsx`, `packages/ui/src/components/index.ts`
- Pre-commit: `bun run lint`

---

### - [x] 1.4 Create RackVisualization Component

**What to do**:
- Create `packages/ui/src/components/rack-visualization.tsx`
- Implement grid-based shelf display with occupied/empty states
- Support hover for item details
- Use existing CSS variables and utility classes

**Component API**:
```tsx
interface RackVisualizationProps {
  rows: number;
  columns: number;
  items: RackItem[];
  onItemClick?: (item: RackItem) => void;
  className?: string;
}

interface RackItem {
  id: string;
  row: number;
  column: number;
  status: 'occupied' | 'empty' | 'reserved';
  label?: string;
}
```

**Must NOT do**:
- Don't use hardcoded zinc values
- Don't add drag-and-drop functionality (keep simple)
- Don't add new dependencies

**Parallelizable**: YES (with 1.3, 1.5)

**References**:

**Design References**:
- `museumlite-app-design.html:2100-2200` - Rack grid visualization design

**Pattern References**:
- `packages/ui/src/globals.css:229-239` - card-elevated, card-interactive classes

**Acceptance Criteria**:
- [ ] Component renders grid with correct dimensions
- [ ] Items show occupied/empty/reserved states with appropriate colors
- [ ] Hover shows item details
- [ ] Click callback works
- [ ] Uses CSS variables only
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `feat(ui): add RackVisualization component for storage display`
- Files: `packages/ui/src/components/rack-visualization.tsx`, `packages/ui/src/components/index.ts`
- Pre-commit: `bun run lint`

---

### - [x] 1.5 Create TimelineView Component

**What to do**:
- Create `packages/ui/src/components/timeline-view.tsx`
- Implement horizontal timeline with event markers
- Support current date indicator
- Support click on events for navigation

**Component API**:
```tsx
interface TimelineViewProps {
  events: TimelineEvent[];
  startDate: Date;
  endDate: Date;
  onEventClick?: (event: TimelineEvent) => void;
  className?: string;
}

interface TimelineEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate?: Date;
  status: 'past' | 'current' | 'upcoming';
  color?: 'emerald' | 'blue' | 'amber' | 'indigo';
}
```

**Must NOT do**:
- Don't use hardcoded zinc values
- Don't add complex date picker functionality
- Don't add new dependencies (use native Date)

**Parallelizable**: YES (with 1.3, 1.4)

**References**:

**Design References**:
- `museumlite-app-design.html:2400-2500` - Timeline view design

**Pattern References**:
- `packages/ui/src/globals.css:241-260` - Badge color utilities

**Acceptance Criteria**:
- [ ] Timeline renders with correct date range
- [ ] Events positioned correctly based on dates
- [ ] Current date indicator visible
- [ ] Click callback works on events
- [ ] Uses CSS variables only
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `feat(ui): add TimelineView component for exhibitions`
- Files: `packages/ui/src/components/timeline-view.tsx`, `packages/ui/src/components/index.ts`
- Pre-commit: `bun run lint`

---

### Milestone 2: Core Pages

---

### - [x] 2.1 Style Objects List and Detail Pages

**What to do**:
- Apply design styling to `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx`
- Apply design styling to `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx`
- Migrate any remaining zinc values using audit map from 1.1
- Ensure grid and list views match design
- Update `_components/*.tsx` files as needed

**Must NOT do**:
- Don't change data fetching logic
- Don't modify Convex queries
- Don't break pagination or filtering
- Don't change component APIs

**Parallelizable**: YES (with 2.2, 2.3)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Current implementation
- `apps/app/src/app/[locale]/(dashboard)/objects/_components/object-grid-view.tsx` - Grid view
- `.sisyphus/plans/design-adaptation.md:448-508` - Previous objects styling (verify complete)

**Design References**:
- `museumlite-app-design.html:909-1170` - Object catalog styling

**Acceptance Criteria**:
- [ ] List view matches design (hover states, spacing, badges)
- [ ] Grid view matches design
- [ ] Detail page matches design
- [ ] No zinc values in modified files (`ast_grep_search` returns empty)
- [ ] `bun run typecheck` passes
- [ ] Browser: both dark and light themes work

**Commit**: YES
- Message: `style(objects): apply design system to objects pages`
- Files: `apps/app/src/app/[locale]/(dashboard)/objects/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 2.2 Style Collections Pages

**What to do**:
- Apply design styling to `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx`
- Apply design styling to collection detail page if exists
- Migrate any zinc values
- Ensure card layout matches design

**Must NOT do**:
- Don't change collection management logic
- Don't modify component APIs

**Parallelizable**: YES (with 2.1, 2.3)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx` - Current implementation

**Design References**:
- `museumlite-app-design.html:1200-1350` - Collections page design

**Acceptance Criteria**:
- [ ] Collection cards match design
- [ ] Hover states correct
- [ ] No zinc values in modified files
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(collections): apply design system to collections pages`
- Files: `apps/app/src/app/[locale]/(dashboard)/collections/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 2.3 Style Media/Digital Assets Pages

**What to do**:
- Apply design styling to media/digital assets pages
- Implement grid view for media items matching design
- Migrate any zinc values

**Must NOT do**:
- Don't change upload/download logic
- Don't modify file handling

**Parallelizable**: YES (with 2.1, 2.2)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/media/page.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:1400-1550` - Digital assets grid design

**Acceptance Criteria**:
- [ ] Media grid matches design
- [ ] Image previews styled correctly
- [ ] No zinc values in modified files
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(media): apply design system to media pages`
- Files: `apps/app/src/app/[locale]/(dashboard)/media/**/*.tsx`
- Pre-commit: `bun run lint`

---

### Milestone 3: Management Pages

---

### - [x] 3.1 Refine Accessions Kanban Styling

**What to do**:
- Verify and refine kanban board styling from v1 work
- Ensure column headers match design
- Verify drag-and-drop visual feedback
- Check mobile/responsive behavior

**Must NOT do**:
- Don't change kanban logic
- Don't modify workflow steps

**Parallelizable**: YES (with 3.2)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/accessions/kanban-column.tsx` - Current implementation
- `.sisyphus/plans/design-adaptation.md:549-577` - Previous accessions fixes

**Design References**:
- `museumlite-app-design.html:1600-1750` - Kanban board design

**Acceptance Criteria**:
- [ ] Kanban columns match design spacing
- [ ] Card styling matches design
- [ ] Drag feedback correct
- [ ] No zinc values (`bg-slate-500` is acceptable replacement)
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(accessions): refine kanban board styling`
- Files: `apps/app/src/app/[locale]/(dashboard)/accessions/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 3.2 Style Deaccessions Table View

**What to do**:
- Apply design styling to deaccessions page
- Ensure DataTable styling matches design
- Status badges styled correctly

**Must NOT do**:
- Don't change deaccession logic
- Don't modify table columns

**Parallelizable**: YES (with 3.1)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/deaccessions/page.tsx` - Current implementation

**Design References**:
- `museumlite-app-design.html:1800-1900` - Deaccessions table design

**Acceptance Criteria**:
- [ ] Table rows have correct hover state (`hover:bg-muted/40`)
- [ ] Status badges match design colors
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(deaccessions): apply design system to deaccessions page`
- Files: `apps/app/src/app/[locale]/(dashboard)/deaccessions/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 3.3 Style Locations Pages with New Components

**What to do**:
- Apply LocationTree component from 1.3 to locations sidebar
- Apply RackVisualization component from 1.4 to location detail
- Migrate all zinc values (60+ occurrences in this section)
- Wire up selection callbacks

**Must NOT do**:
- Don't change location data models
- Don't modify navigation behavior beyond using new components

**Parallelizable**: NO (depends on 1.3, 1.4)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/locations/*.tsx` - Current implementation (8 files)
- Task 1.3 - LocationTree component
- Task 1.4 - RackVisualization component

**Design References**:
- `museumlite-app-design.html:1900-2200` - Locations page design

**Acceptance Criteria**:
- [ ] LocationTree component used for sidebar
- [ ] RackVisualization component used for storage display
- [ ] All 60+ zinc values migrated
- [ ] Selection and navigation work correctly
- [ ] `bun run typecheck` passes
- [ ] `ast_grep_search` in locations folder returns empty

**Commit**: YES
- Message: `style(locations): integrate tree and rack components, migrate zinc values`
- Files: `apps/app/src/app/[locale]/(dashboard)/locations/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 3.4 Style Loans Pages

**What to do**:
- Apply design styling to loans list and detail pages
- Migrate zinc values in print/PDF section (mark exempt)
- Ensure incoming/outgoing sections match design

**Must NOT do**:
- Don't change loan workflow logic
- Don't modify print PDF content (only mark as exempt)

**Parallelizable**: NO (after 3.3)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx` - Loan list
- `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx` - Loan detail with print section
- `.sisyphus/plans/design-adaptation.md:531-541` - Previous loans notes

**Design References**:
- `museumlite-app-design.html:2200-2350` - Loans page design

**Acceptance Criteria**:
- [ ] Loan list matches design
- [ ] Incoming/outgoing sections styled
- [ ] Print section zinc values DOCUMENTED as exempt (with `[PRINT-EXEMPT]` comment)
- [ ] Non-print zinc values migrated
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(loans): apply design system, mark print dialogs exempt`
- Files: `apps/app/src/app/[locale]/(dashboard)/loans/**/*.tsx`
- Pre-commit: `bun run lint`

---

### Milestone 4: Feature Pages

---

### - [x] 4.1 Style Exhibitions Pages with Timeline

**What to do**:
- Apply design styling to exhibitions list and detail
- Integrate TimelineView component from 1.5
- Migrate zinc values (button in line 129 was fixed in v1)
- Gallery/timeline view toggle

**Must NOT do**:
- Don't change exhibition management logic
- Don't modify date handling

**Parallelizable**: YES (with 4.2, 4.3 after 1.5)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/exhibitions/page.tsx` - Current implementation
- Task 1.5 - TimelineView component
- `.sisyphus/plans/design-adaptation.md:539-548` - Previous exhibitions fixes

**Design References**:
- `museumlite-app-design.html:2400-2550` - Exhibitions page design

**Acceptance Criteria**:
- [ ] Exhibition cards match design
- [ ] TimelineView integrated for timeline mode
- [ ] Gallery view matches design
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(exhibitions): integrate timeline component, apply design`
- Files: `apps/app/src/app/[locale]/(dashboard)/exhibitions/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 4.2 Style Conservation Pages

**What to do**:
- Apply design styling to conservation ticket table
- Migrate zinc values in button variants
- Status badges for ticket states

**Must NOT do**:
- Don't change conservation workflow logic

**Parallelizable**: YES (with 4.1, 4.3)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/conservation/**/*.tsx` - Current implementation

**Design References**:
- `museumlite-app-design.html:2600-2750` - Conservation page design

**Acceptance Criteria**:
- [ ] Ticket table matches design
- [ ] Status badges correct
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(conservation): apply design system to conservation pages`
- Files: `apps/app/src/app/[locale]/(dashboard)/conservation/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 4.3 Style Insurance Pages (N/A - directory does not exist)

**What to do**:
- Apply design styling to insurance policies/claims pages
- Migrate zinc values
- Table and card styling

**Must NOT do**:
- Don't change insurance data logic

**Parallelizable**: YES (with 4.1, 4.2)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/insurance/**/*.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:2800-2900` - Insurance page design

**Acceptance Criteria**:
- [ ] Policy list matches design
- [ ] Claims section styled
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(insurance): apply design system to insurance pages`
- Files: `apps/app/src/app/[locale]/(dashboard)/insurance/**/*.tsx`
- Pre-commit: `bun run lint`

---

### Milestone 5: Library Module

---

### - [ ] 5.1 Style Library Catalog Page

**What to do**:
- Apply design styling to library catalog
- Grid/list view for library items
- Search and filter styling

**Must NOT do**:
- Don't change library data logic

**Parallelizable**: YES (with 5.2-5.5)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/library/catalog/**/*.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:2950-3050` - Library catalog design

**Acceptance Criteria**:
- [ ] Catalog matches design
- [ ] Search/filter styled
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(library): apply design system to catalog page`
- Files: `apps/app/src/app/[locale]/(dashboard)/library/catalog/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [ ] 5.2 Style Library Circulation Page

**What to do**:
- Apply design styling to circulation (checkouts/returns)
- Table styling for transactions

**Must NOT do**:
- Don't change circulation logic

**Parallelizable**: YES (with 5.1, 5.3-5.5)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/library/circulation/**/*.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:3100-3200` - Circulation design

**Acceptance Criteria**:
- [ ] Circulation page matches design
- [ ] Transaction table styled
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(library): apply design system to circulation page`
- Files: `apps/app/src/app/[locale]/(dashboard)/library/circulation/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [ ] 5.3 Style Library Patrons Page

**What to do**:
- Apply design styling to patron list/detail
- Table and card styling

**Must NOT do**:
- Don't change patron management logic

**Parallelizable**: YES (with 5.1-5.2, 5.4-5.5)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/library/patrons/**/*.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:3250-3350` - Patrons design

**Acceptance Criteria**:
- [ ] Patrons list matches design
- [ ] Detail page styled
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(library): apply design system to patrons page`
- Files: `apps/app/src/app/[locale]/(dashboard)/library/patrons/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [ ] 5.4 Style Library Fines Page

**What to do**:
- Apply design styling to fines management
- Table styling for fine records

**Must NOT do**:
- Don't change fines calculation logic

**Parallelizable**: YES (with 5.1-5.3, 5.5)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/library/fines/**/*.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:3400-3500` - Fines design

**Acceptance Criteria**:
- [ ] Fines page matches design
- [ ] Amount styling correct
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(library): apply design system to fines page`
- Files: `apps/app/src/app/[locale]/(dashboard)/library/fines/**/*.tsx`
- Pre-commit: `bun run lint`

---

### - [ ] 5.5 Style Library Acquisitions Page

**What to do**:
- Apply design styling to acquisitions workflow
- Status indicators and cards

**Must NOT do**:
- Don't change acquisition workflow logic

**Parallelizable**: YES (with 5.1-5.4)

**References**:

**Pattern References**:
- `apps/app/src/app/[locale]/(dashboard)/library/acquisitions/**/*.tsx` - If exists

**Design References**:
- `museumlite-app-design.html:3550-3650` - Acquisitions design

**Acceptance Criteria**:
- [ ] Acquisitions page matches design
- [ ] Status indicators correct
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(library): apply design system to acquisitions page`
- Files: `apps/app/src/app/[locale]/(dashboard)/library/acquisitions/**/*.tsx`
- Pre-commit: `bun run lint`

---

### Milestone 6: Final Polish

---

### - [ ] 6.1 Style All Loading States (28 files)

**What to do**:
- Apply consistent skeleton styling to all 28 loading.tsx files
- Use existing skeleton component patterns
- Match loading states to page content structure

**Must NOT do**:
- Don't change loading logic
- Don't add new skeleton components unless necessary

**Parallelizable**: NO (after all page styling)

**References**:

**Pattern References**:
- `packages/ui/src/components/skeleton.tsx` - Skeleton component
- `apps/app/src/app/[locale]/(dashboard)/page.tsx` - Example loading

**Acceptance Criteria**:
- [ ] All 28 loading.tsx files styled consistently
- [ ] Skeleton colors use CSS variables
- [ ] No zinc values
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(loading): apply consistent skeleton styling`
- Files: All `loading.tsx` files
- Pre-commit: `bun run lint`

---

### - [ ] 6.2 Style Empty States

**What to do**:
- Apply consistent empty state styling across pages
- Use EmptyState component where available
- Match design placeholder illustrations

**Must NOT do**:
- Don't create custom illustrations
- Don't change empty state messaging

**Parallelizable**: YES (with 6.3)

**References**:

**Pattern References**:
- `packages/ui/src/components/empty-state.tsx` - If exists

**Design References**:
- `museumlite-app-design.html` - Empty state patterns

**Acceptance Criteria**:
- [ ] Empty states consistent across pages
- [ ] CSS variable-based styling
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(empty): apply consistent empty state styling`
- Files: Pages with empty states
- Pre-commit: `bun run lint`

---

### - [ ] 6.3 Style Error States

**What to do**:
- Apply consistent error state styling
- Error boundaries and error messages
- Match design patterns

**Must NOT do**:
- Don't change error handling logic
- Don't modify error boundaries behavior

**Parallelizable**: YES (with 6.2)

**References**:

**Pattern References**:
- Error boundary components if they exist

**Acceptance Criteria**:
- [ ] Error states consistent
- [ ] CSS variable-based styling
- [ ] `bun run typecheck` passes

**Commit**: YES
- Message: `style(error): apply consistent error state styling`
- Files: Error components
- Pre-commit: `bun run lint`

---

### - [ ] 6.4 Final Verification and Cleanup

**What to do**:
- Run comprehensive `ast_grep_search` for zinc values across entire codebase
- Verify all print dialogs are properly marked as exempt
- Test theme switching: dark → light → system
- Run full typecheck and lint
- Manual browser verification of all page types

**Verification Commands**:
```bash
# Find any remaining zinc values (should only be print-exempt)
ast_grep_search --pattern "zinc-" --lang tsx

# Full typecheck
bun run typecheck

# Full lint
bun run lint
```

**Must NOT do**:
- Don't skip verification
- Don't commit if issues found

**Parallelizable**: NO (final step)

**References**:
- All files modified in previous tasks
- Task 1.1 zinc audit for comparison

**Acceptance Criteria**:
- [ ] `ast_grep_search` for zinc: Only print-exempt occurrences remain
- [ ] `bun run typecheck` passes (settings errors acceptable)
- [ ] `bun run lint` passes
- [ ] Theme switcher: dark → light → system works without crashes
- [ ] Browser: Spot-check 5 pages in both themes:
  - [ ] Dashboard: KPI cards, activity log
  - [ ] Objects list: grid/list views
  - [ ] Locations: tree sidebar, rack visualization
  - [ ] Exhibitions: timeline view
  - [ ] Library catalog: grid view

**Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1.2 | `refactor(sidebar): restructure navigation groups` | app-sidebar.tsx | typecheck |
| 1.3 | `feat(ui): add LocationTree component` | location-tree.tsx | typecheck |
| 1.4 | `feat(ui): add RackVisualization component` | rack-visualization.tsx | typecheck |
| 1.5 | `feat(ui): add TimelineView component` | timeline-view.tsx | typecheck |
| 2.1 | `style(objects): apply design system` | objects/**/*.tsx | typecheck, zinc search |
| 2.2 | `style(collections): apply design system` | collections/**/*.tsx | typecheck |
| 2.3 | `style(media): apply design system` | media/**/*.tsx | typecheck |
| 3.1 | `style(accessions): refine kanban styling` | accessions/**/*.tsx | typecheck |
| 3.2 | `style(deaccessions): apply design system` | deaccessions/**/*.tsx | typecheck |
| 3.3 | `style(locations): integrate components` | locations/**/*.tsx | typecheck, zinc search |
| 3.4 | `style(loans): apply design system` | loans/**/*.tsx | typecheck |
| 4.1 | `style(exhibitions): integrate timeline` | exhibitions/**/*.tsx | typecheck |
| 4.2 | `style(conservation): apply design system` | conservation/**/*.tsx | typecheck |
| 4.3 | `style(insurance): apply design system` | insurance/**/*.tsx | typecheck |
| 5.1-5.5 | `style(library): apply design system` | library/**/*.tsx | typecheck |
| 6.1 | `style(loading): consistent skeletons` | loading.tsx files | typecheck |
| 6.2-6.3 | `style(states): empty and error states` | state components | typecheck |

---

## Success Criteria

### Verification Commands

```bash
# Check for remaining zinc values (should be empty or only print-exempt)
ast_grep_search --pattern "zinc-" --lang tsx --paths apps/app/

# Full typecheck
bun run typecheck

# Full lint
bun run lint

# Theme switch test (manual in browser)
# Navigate to each page, toggle theme, verify no crashes
```

### Final Checklist

- [ ] All "Must Have" present:
  - [ ] Sidebar restructured with 5 design groups
  - [ ] LocationTree, RackVisualization, TimelineView components created
  - [ ] All 99 zinc occurrences addressed (migrated or marked exempt)
  - [ ] All 68 pages styled
  
- [ ] All "Must NOT Have" absent:
  - [ ] No new zinc values added
  - [ ] No new pages created
  - [ ] No component API changes
  - [ ] No new npm dependencies
  - [ ] Settings pages untouched
  - [ ] Backend unchanged

- [ ] Theme switching: dark → light → system works
- [ ] All acceptance criteria in 6.4 verified
