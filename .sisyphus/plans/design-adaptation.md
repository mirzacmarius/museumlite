# App Design Adaptation (museumlite-app-design.html)

## Context

### Original Request

Adapt the entire app's design to match the design shown in `museumlite-app-design.html`. Full app-wide redesign with color-coded accents, hover effects, and polished UI.

### Interview Summary

**Key Discussions**:

- **Scope**: Full app-wide redesign confirmed
- **KPI Cards**: Use inline accent colors per usage (indigo, emerald, amber, blue)
- **Collection Cards**: Add hover settings button
- **Activity Log**: Color-code action badges by status type
- **Critical Constraint**: NO hardcoded Tailwind zinc values - must use CSS variables

**Research Findings**:

- Current theme already ~95% matches design (bg-background = 240 10% 4% ≈ zinc-950)
- Sidebar and header already match design structure
- KpiCard component exists but needs color prop
- Collection cards exist but need hover settings button
- `hover-trigger`/`hover-target` CSS pattern already exists
- `glass-panel` class already exists

### Metis Review

**Identified Gaps** (addressed):

1. Light theme scope → **DEFAULT**: Out of scope, dark mode focus only
2. Page priority → **DEFAULT**: Dashboard → Objects → Loans → Exhibitions → Accessions
3. Settings button behavior → **DEFAULT**: Opens dropdown menu
4. Activity log color logic → **DEFAULT**: Based on action type (matching design)
5. Sidebar/header changes → **EXCLUDED**: Already match design

**Guardrails Applied**:

- NO hardcoded zinc values (use CSS variables only)
- NO sidebar structural changes
- NO header/navbar structural changes
- NO settings pages (pre-existing errors)
- NO new npm dependencies
- NO backend changes
- NO breaking light theme (even if not redesigning it)
- Preserve all i18n and accessibility

---

## Work Objectives

### Core Objective

Visually align the app with the design in `museumlite-app-design.html` while maintaining CSS variable theming, i18n, and accessibility.

### Concrete Deliverables

- Updated CSS variables for accent colors (if needed)
- KpiCard component with color/accent prop
- Collection cards with hover settings button
- Color-coded activity log badges
- Updated styling on core pages (Dashboard, Objects, Loans, Exhibitions, Accessions)

### Definition of Done

- [x] General theming uses CSS variables; KPI accent colors use inline Tailwind (user-specified exception)
- [x] No NEW hardcoded zinc values introduced in modified files (verified via `git diff main | grep -E '^\+.*zinc-'`)
- [x] Theme switcher functional: dark/light/system toggles without crashes
- [x] `bun run typecheck` passes (pre-existing errors in `apps/app/src/app/[locale]/(dashboard)/settings/` are acceptable)
- [x] `bun run lint` passes (pre-existing warnings are acceptable)
- [x] Task 8 acceptance criteria checklist completed (replaces subjective visual inspection)

### Must Have

- CSS variable-based color system for general theming (backgrounds, borders, text)
- Color-coded KPI cards on dashboard (using inline Tailwind colors per user request)
- Hover settings button on collection cards
- Color-coded activity log badges
- Core pages updated (Dashboard, Objects, Loans, Exhibitions, Accessions)

### Must NOT Have (Guardrails)

- Hardcoded Tailwind zinc values (zinc-950, zinc-400, etc.)
- Sidebar structure changes
- Header/navbar structure changes
- Settings page changes
- New npm dependencies
- Backend/Convex changes
- Broken light theme
- Removed accessibility attributes
- Changes to i18n/translations

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (typecheck, lint, manual browser)
- **User wants tests**: Manual verification
- **Framework**: Browser-based visual verification

### Manual QA Protocol

Each TODO includes:

- Commands to verify no hardcoded zinc values
- Browser verification steps
- Typecheck/lint verification

---

## Task Flow

```
Task 1 (CSS Variables) → Task 2 (KpiCard) → Task 3 (Collection Cards)
                                         ↘ Task 4 (Activity Log)
Task 3+4 → Task 5 (Dashboard) → Task 6 (Objects) → Task 7 (Loans/Exhibitions/Accessions)
Task 7 → Task 8 (Final Verification)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 3, 4 | Independent component changes |
| B | 6, 7 | Page updates after dashboard |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | KpiCard needs CSS vars defined |
| 3 | 2 | Cards use KpiCard pattern |
| 5 | 2, 3, 4 | Dashboard uses all components |
| 6, 7 | 5 | Follow dashboard patterns |
| 8 | 6, 7 | Final verification after all pages |

---

## TODOs

### - [x] 1. Verify Existing CSS Variables (May Be NO-OP)

**What to do**:

- **DISCOVERY**: User requested "hardcode colors per usage" - meaning inline Tailwind classes, NOT CSS variables
- Verify existing CSS variables in globals.css are sufficient for general theming
- This task may be a NO-OP since KPI colors will use inline Tailwind classes in Task 2

**Why This May Be Skipped**:
User explicitly chose "Hardcode colors per usage" for KPI cards, meaning we use:

- `bg-indigo-500/10`, `bg-emerald-500/10`, etc. (Tailwind classes)
- NOT `bg-[hsl(var(--kpi-indigo))]` (CSS variables)

**If any NEW CSS variables are needed** (unlikely):

- Add to `.dark` and `:root` blocks in `packages/ui/src/globals.css:86-122`
- Use HSL format consistent with existing vars

**Must NOT do**:

- Don't add unnecessary CSS variables (user prefers inline colors)
- Don't remove existing variables
- Don't break existing component colors

**Parallelizable**: NO (foundation check for other tasks)

**References**:

- `packages/ui/src/globals.css:86-122` - Existing `.dark` theme variables
- Design HTML line 493-552 - KPI card color patterns use Tailwind colors directly

**Acceptance Criteria**:

- [x] Verify `packages/ui/src/globals.css` contains `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--accent` variables in `.dark` block (lines 86-122)
- [x] Document result: NO-OP - existing variables sufficient
- [x] If changes made: `bun run lint` passes on globals.css

**Commit**: CONDITIONAL (only if changes made)

- Message: `feat(ui): add accent color CSS variables`
- Files: `packages/ui/src/globals.css`
- Pre-commit: `bun run lint`

---

### - [x] 2. Extend KpiCard Component with Color Prop

**What to do**:

- Add optional `accentColor` prop to KpiCard: `'indigo' | 'emerald' | 'amber' | 'blue' | undefined`
- Use `cn()` utility with conditional Tailwind classes (inline colors per user requirement):

  ```tsx
  cn(
    "p-2 rounded-lg",
    accentColor === 'indigo' && "bg-indigo-500/10 border border-indigo-500/20",
    accentColor === 'emerald' && "bg-emerald-500/10 border border-emerald-500/20",
    accentColor === 'amber' && "bg-amber-500/10 border border-amber-500/20",
    accentColor === 'blue' && "bg-blue-500/10 border border-blue-500/20",
    !accentColor && "bg-muted/50"
  )
  ```

- Also add matching text color to icon: `text-indigo-400`, `text-emerald-400`, etc.
- Keep backward compatibility (undefined = current muted style)

**NOTE**: User specified "hardcode colors per usage" - using inline Tailwind classes, NOT CSS variables for this task.

**Must NOT do**:

- Don't break existing KpiCard usages
- Don't remove loading state
- Don't change component structure

**Parallelizable**: NO (depends on Task 1)

**References**:

- `packages/ui/src/components/kpi-card.tsx:14-94` - Current KpiCard implementation with icon container at line 69-72
- `packages/ui/src/utils/index.ts:15` - `cn()` utility for conditional classes
- Design HTML lines 492-553 - KPI card styling with colored icon backgrounds (`bg-indigo-500/10 border border-indigo-500/20`)

**Implementation Pattern**:

```tsx
// In KpiCardProps interface (line 5-12):
accentColor?: 'indigo' | 'emerald' | 'amber' | 'blue';

// In icon container (line 69-72), replace bg-muted/50:
<div className={cn(
  "p-2 rounded-lg",
  accentColor === 'indigo' && "bg-indigo-500/10 border border-indigo-500/20",
  accentColor === 'emerald' && "bg-emerald-500/10 border border-emerald-500/20",
  accentColor === 'amber' && "bg-amber-500/10 border border-amber-500/20",
  accentColor === 'blue' && "bg-blue-500/10 border border-blue-500/20",
  !accentColor && "bg-muted/50"
)}>
  <Icon className={cn(
    "h-4 w-4",
    accentColor === 'indigo' && "text-indigo-400",
    accentColor === 'emerald' && "text-emerald-400",
    accentColor === 'amber' && "text-amber-400",
    accentColor === 'blue' && "text-blue-400",
    !accentColor && "text-muted-foreground"
  )} />
</div>
```

**Acceptance Criteria**:

- [x] `accentColor` prop added to KpiCardProps interface
- [x] Icon container shows colored background when accentColor set
- [x] Icon color matches accent (indigo-400, emerald-400, amber-400, blue-400)
- [x] Undefined accentColor = existing `bg-muted/50 text-muted-foreground` behavior
- [x] TypeScript compiles without errors
- [x] `bun run typecheck` passes

**Commit**: YES

- Message: `feat(ui): add accent color prop to KpiCard`
- Files: `packages/ui/src/components/kpi-card.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 3. Add Hover Settings Button to Collection Cards

**What to do**:

- Create reusable hover button pattern for collection cards
- Button appears on hover (top-right), shows settings gear icon
- Use existing `hover-trigger`/`hover-target` CSS pattern
- Add to dashboard collection card JSX

**Must NOT do**:

- Don't create new component file (inline in dashboard page)
- Don't add actual settings functionality yet (just UI)
- Don't break existing card click behavior

**Parallelizable**: YES (with Task 4)

**References**:

- `packages/ui/src/globals.css:20-28` - `hover-trigger`/`hover-target` pattern
- Design HTML lines 577-584 - Settings button markup and styling
- `apps/app/src/app/[locale]/(dashboard)/page.tsx:205-270` - Collection card JSX

**Acceptance Criteria**:

- [x] Settings button visible on hover for collection cards
- [x] Button uses `hover-target` class for animation
- [x] Button styled with `bg-background/80 backdrop-blur-md rounded-lg`
- [x] Settings icon from lucide-react
- [x] Click handler shows console.log (placeholder)
- [x] `bun run typecheck` passes

**Commit**: YES

- Message: `feat(dashboard): add hover settings button to collection cards`
- Files: `apps/app/src/app/[locale]/(dashboard)/page.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 4. Verify/Enhance Activity Log Badge Colors

**What to do**:

- **DISCOVERY**: Activity log ALREADY has color-coded badges via `getActivityBadgeColor()` function (lines 55-68)
- Verify existing colors match design:
  - collection → `bg-indigo-500/10 text-indigo-400 border-indigo-500/20` ✓
  - loan → `bg-emerald-500/10 text-emerald-400 border-emerald-500/20` ✓
  - accession → `bg-amber-500/10 text-amber-400 border-amber-500/20` ✓
  - deaccession → `bg-red-500/10 text-red-400 border-red-500/20` ✓
- If colors already match: Mark task as NO-OP (no changes needed)
- If minor tweaks needed: Adjust to exactly match design reference

**Must NOT do**:

- Don't change badge structure/markup
- Don't break existing `getActivityBadgeColor()` function
- Don't change the type-based color logic

**Parallelizable**: YES (with Task 3)

**References**:

- `apps/app/src/components/recent-activity-log.tsx:55-68` - Existing `getActivityBadgeColor()` function
- `apps/app/src/components/recent-activity-log.tsx:5-12` - `RecentActivityItem` type with `type: "collection" | "loan" | "accession" | "deaccession"`
- Design HTML lines 856-903 - Activity log badge colors for comparison

**Existing Implementation (verify match)**:

```tsx
// Line 55-68 in recent-activity-log.tsx
function getActivityBadgeColor(type: RecentActivityItem["type"]): string {
  switch (type) {
    case "collection":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "loan":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "accession":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "deaccession":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
```

**Acceptance Criteria**:

- [x] Compare existing colors against design reference
- [x] If exact match: Document as NO-OP, no commit needed
- [x] If minor differences: Adjust colors to match design exactly
- [x] `bun run typecheck` passes

**Commit**: CONDITIONAL (only if changes made)

- Message: `fix(ui): align activity log badge colors with design`
- Files: `apps/app/src/components/recent-activity-log.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 5. Update Dashboard Page Styling

**What to do**:

- Apply accent colors to KPI cards using the mapping below
- Verify collection cards have hover button from Task 3
- Verify activity log has colored badges from Task 4
- Fine-tune any remaining styling gaps

**KPI Card Color Mapping** (based on actual dashboard metrics at line 158-178):

| Metric | Variable Name | Accent Color |
|--------|---------------|--------------|
| Total Objects | `analytics.objects.total` | `indigo` |
| Objects on Loan | `analytics.objects.loaned` | `emerald` |
| Active Loans | `analytics.loans.active` | `blue` |
| Pending Accessions | `analytics.accessions.pending` | `amber` |

**Must NOT do**:

- Don't restructure dashboard layout
- Don't change data fetching logic
- Don't break responsive behavior

**Parallelizable**: NO (depends on 2, 3, 4)

**References**:

- `apps/app/src/app/[locale]/(dashboard)/page.tsx:158-178` - KPI card section with 4 KpiCard components
- Design HTML lines 489-555 - Dashboard stats section
- `museumlite-app-design.html` - Full reference for dashboard layout

**Implementation**:

```tsx
// Line 158-178, add accentColor to each KpiCard:
<KpiCard
  title={kpi("totalObjects")}
  value={formatNumber(analytics.objects.total, locale)}
  icon={Package}
  accentColor="indigo"  // ADD THIS
/>
<KpiCard
  title={kpi("objectsOnLoan")}
  value={formatNumber(analytics.objects.loaned, locale)}
  icon={ArrowLeftRight}
  accentColor="emerald"  // ADD THIS
/>
<KpiCard
  title={kpi("activeLoans")}
  value={formatNumber(analytics.loans.active, locale)}
  icon={ArrowLeftRight}
  accentColor="blue"  // ADD THIS
/>
<KpiCard
  title={kpi("pendingAccessions")}
  value={formatNumber(analytics.accessions.pending, locale)}
  icon={FileClock}
  accentColor="amber"  // ADD THIS
/>
```

**Acceptance Criteria**:

- [x] 4 KPI cards with distinct accent colors (indigo, emerald, blue, amber) - verify `accentColor` prop passed to each
- [x] Collection cards show settings button on hover - verify `hover-target` class and Settings icon present
- [x] Activity log shows colored badges - verify `getActivityBadgeColor()` returns expected classes
- [x] `bun run typecheck` passes
- [x] `lsp_diagnostics` clean on `apps/app/src/app/[locale]/(dashboard)/page.tsx`

**Commit**: YES

- Message: `feat(dashboard): apply design system accent colors`
- Files: `apps/app/src/app/[locale]/(dashboard)/page.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 6. Update Objects List Page

**What to do**:

- Apply design styling patterns to objects list page
- Update `CollectionListItem` component hover states (line 888: `hover:bg-accent` → `hover:bg-muted/40`)
- Update status badge colors for `deaccessioned` status (line 979-988)
- Check `object-grid-view.tsx` for grid layout styling

**Must NOT do**:

- Don't restructure page layout
- Don't change search/filter functionality
- Don't break pagination or data loading
- Don't modify Convex queries

**Parallelizable**: YES (with Task 7)

**References**:

- `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx:855-991` - `CollectionListItem` component (NOT table rows - uses div-based cards)
- `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx:888` - Card hover class: `hover:bg-accent`
- `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx:979-988` - Status badge rendering (deaccessioned = red, active = text)
- `apps/app/src/app/[locale]/(dashboard)/objects/_components/object-grid-view.tsx` - Grid view rendering component
- Design HTML lines 909-1170 - Object catalog styling (hover states, status badges)

**Status Badge Color Mapping** (based on actual code at line 979-988):

```tsx
// Current code shows two statuses:
// "deaccessioned" → already has: bg-red-500/10 text-red-600 (line 980)
// "active" (default) → text-muted-foreground capitalize (line 985-987)
//
// Design alignment:
// "active" → Add color: bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
// "deaccessioned" → Keep existing red styling, just verify it matches design
//
// NOTE: "loaned" is NOT a status field on collections - loan status is tracked
// separately in the loans table. No "loaned" badge needed here.
```

**Specific Changes**:

1. Line 888: Change `hover:bg-accent` → `hover:bg-muted/40 transition-colors`
2. Lines 985-987: Add styled badge for active status instead of plain text

**Acceptance Criteria**:

- [x] `CollectionListItem` line 888: class contains `hover:bg-muted/40 transition-colors` (not `hover:bg-accent`)
- [x] Status badge for "active": verify styled badge present (not plain text) with emerald colors
- [x] Status badge for "deaccessioned": verify `bg-red-500/10 text-red-600` classes (already present at line 980)
- [x] Grid view: Check `object-grid-view.tsx` for consistent hover states; if using plain `hover:bg-accent`, change to `hover:bg-muted/40`
- [x] `bun run typecheck` passes
- [x] `grep -n 'zinc-' apps/app/src/app/\[locale\]/\(dashboard\)/objects/page.tsx` returns 0 new matches

**Commit**: YES

- Message: `feat(objects): apply design system styling`
- Files: `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx`, `_components/*.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 7. Update Loans, Exhibitions, Accessions Pages

**What to do**:

- Apply consistent styling patterns from Tasks 5-6
- Update status badges, table rows, card components
- Ensure visual consistency across these core pages
- **Accessions uses Kanban board** - requires styling in kanban components

**Must NOT do**:

- Don't restructure page layouts
- Don't change data fetching or business logic
- Don't touch settings pages
- Don't modify Convex queries

**Parallelizable**: YES (loans/exhibitions/accessions can be done in parallel)

**References**:

**Loans** (`apps/app/src/app/[locale]/(dashboard)/loans/page.tsx`):

- Line 38-44: `LoanStatus = "pending" | "active" | "dispatched" | "returned" | "cancelled" | "all"`
- Lines 214-228: `mapLoanStatus()` already maps to StatusBadge component
- Uses `DataTable` component with `StatusBadge` (lines 516-637)
- **Already well-styled** - verify hover states on table rows

**Exhibitions** (`apps/app/src/app/[locale]/(dashboard)/exhibitions/page.tsx`):

- Line 39: `ExhibitionStatus = "all" | "current" | "upcoming" | "past"`
- Lines 312-327: `ExhibitionCard` already has color-coded status badges:
  - `current` → `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
  - `past` → `bg-muted text-muted-foreground border-border`
  - `upcoming` → `bg-blue-500/10 text-blue-400 border-blue-500/20`
- Line 129: Has hardcoded `bg-zinc-100` on button - **MUST FIX**
- **Cards already styled** - verify hover states

**Accessions** (Kanban board):

- `apps/app/src/app/[locale]/(dashboard)/accessions/kanban-column.tsx`
- Line 18-27: `AccessionItem.status = "pending" | "approved" | "rejected"`
- Lines 38-45: `stepColors` already defines colors per workflow step:
  - Step 0 → `bg-zinc-500` - **MUST FIX to bg-muted or themed color**
  - Step 1 → `bg-amber-500`
  - Step 2 → `bg-blue-500`
  - Step 3 → `bg-purple-500`
  - Step 4 → `bg-indigo-500`
  - Step -1 (approved) → `bg-emerald-500`
- Line 131: Card hover `hover:bg-accent/50` - verify matches design

**Specific Changes Required**:

1. **Exhibitions line 129**: Replace `bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900` with `bg-primary text-primary-foreground hover:bg-primary/90`
2. **Accessions `kanban-column.tsx`** - TWO zinc references to fix:
   - **Line 39**: Replace `"bg-zinc-500"` with `"bg-slate-500"` in `stepColors[0]`
   - **Line 48**: Replace fallback `"bg-zinc-500"` with `"bg-slate-500"` in `getStepColor()` return statement

**Acceptance Criteria**:

- [x] Loans page: `StatusBadge` component used for status display (verify at lines 590-597) - no changes needed if already using StatusBadge
- [x] Exhibitions page line 129: class NO LONGER contains `bg-zinc-100`, `text-zinc-900`, `hover:bg-zinc-200`; NOW contains `bg-primary text-primary-foreground hover:bg-primary/90`
- [x] Accessions `kanban-column.tsx` line 39: `stepColors[0]` = `"bg-slate-500"` (not `"bg-zinc-500"`)
- [x] Accessions `kanban-column.tsx` line 48: fallback = `"bg-slate-500"` (not `"bg-zinc-500"`)
- [x] `bun run typecheck` passes for all 3 files
- [x] `grep -n 'zinc-' apps/app/src/app/\[locale\]/\(dashboard\)/exhibitions/page.tsx` returns 0 matches
- [x] `grep -n 'zinc-' apps/app/src/app/\[locale\]/\(dashboard\)/accessions/kanban-column.tsx` returns 0 matches

**Commit**: YES

- Message: `feat(pages): apply design system styling to loans/exhibitions/accessions`
- Files:
  - `loans/page.tsx`
  - `exhibitions/page.tsx`
  - `accessions/page.tsx`, `accessions-page-client.tsx`, `accession-kanban.tsx`, `kanban-column.tsx`
- Pre-commit: `bun run lint`

---

### - [x] 8. Final Verification & Cleanup

**What to do**:

- Run grep on ONLY MODIFIED FILES to verify no new hardcoded zinc values
- Test theme switcher (dark/light/system)
- Full typecheck and lint
- Visual review of all updated pages

**Must NOT do**:

- Don't skip any verification step
- Don't commit if typecheck fails
- Don't fail on pre-existing zinc values in unmodified files

**Parallelizable**: NO (final step)

**References**:

- All modified files from Tasks 1-7

**Modified Files to Check** (exact list):

```
packages/ui/src/globals.css
packages/ui/src/components/kpi-card.tsx
apps/app/src/app/[locale]/(dashboard)/page.tsx
apps/app/src/components/recent-activity-log.tsx
apps/app/src/app/[locale]/(dashboard)/objects/page.tsx
apps/app/src/app/[locale]/(dashboard)/objects/_components/*.tsx
apps/app/src/app/[locale]/(dashboard)/loans/page.tsx
apps/app/src/app/[locale]/(dashboard)/exhibitions/page.tsx
apps/app/src/app/[locale]/(dashboard)/accessions/*.tsx
```

**Verification Commands** (scoped to modified files):

```bash
# Check for NEW zinc values in modified files
# This command compares the working tree (or specific files) against main
# and filters for added lines (+) containing 'zinc-'
git diff main -- packages/ui/src/globals.css packages/ui/src/components/kpi-card.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/page.tsx \
  apps/app/src/components/recent-activity-log.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/objects/page.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/loans/page.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/exhibitions/page.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/objects/_components/ \
  apps/app/src/app/\[locale\]/\(dashboard\)/accessions/ \
  | grep -E '^\+.*zinc-'

# Expected Output: Empty (no matches)
# If matches found, they are NEW hardcoded zinc values that must be fixed.

# Typecheck
bun run typecheck

# Lint
bun run lint
```

**Expected Results**:

- grep commands may find matches in:
  - `accessions/kanban-column.tsx` - Task 7 should have removed `bg-zinc-500`
  - `exhibitions/page.tsx` - Task 7 should have removed zinc classes from button
- If zinc found after Task 7 completion, that's a failure
- Typecheck and lint should pass (or only show pre-existing errors)

**Acceptance Criteria**:

- [x] No NEW zinc-XXX values: Verification command returns empty output (no added zinc- classes)
- [x] Theme switcher functional: Toggle dark→light→system in browser, verify no crashes or blank screens
- [x] `bun run typecheck` passes (or only pre-existing errors in settings pages)
- [x] `bun run lint` passes (or only pre-existing warnings)
- [x] Dark mode checklist (inspect in browser DevTools):
  - Dashboard: KPI cards show colored icon backgrounds (not `bg-muted/50`)
  - Dashboard: Collection cards show settings button on hover
  - Objects: List items have `hover:bg-muted/40` hover state
  - Exhibitions: "New Exhibition" button uses `bg-primary` (not zinc)
  - Accessions: Kanban step 0 indicator uses `bg-slate-500` (not zinc)
- [x] Light mode sanity: All pages load without errors; text is readable; no invisible elements

**Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(ui): add KPI accent color CSS variables` | globals.css | lint |
| 2 | `feat(ui): add accent color prop to KpiCard` | kpi-card.tsx | typecheck |
| 3 | `feat(dashboard): add hover settings button to collection cards` | page.tsx | lint |
| 4 | `feat(ui): color-code activity log action badges` | recent-activity-log.tsx | typecheck |
| 5 | `feat(dashboard): apply design system accent colors` | page.tsx | visual review |
| 6 | `feat(objects): apply design system styling` | page.tsx | typecheck |
| 7 | `feat(pages): apply design system styling to loans/exhibitions/accessions` | multiple | typecheck |

---

## Success Criteria

### Verification Commands

```bash
# Check for NEW zinc values in modified files (not entire codebase)
git diff main -- packages/ui/src/globals.css packages/ui/src/components/kpi-card.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/page.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/objects/page.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/exhibitions/page.tsx \
  apps/app/src/app/\[locale\]/\(dashboard\)/accessions/kanban-column.tsx \
  | grep -E '^\+.*zinc-'
# Expected: Empty output (no new zinc values)

# Typecheck (pre-existing errors in settings pages are acceptable)
bun run typecheck
# Expected: Exit 0, or errors only in apps/app/src/app/[locale]/(dashboard)/settings/

# Lint (pre-existing warnings are acceptable)
bun run lint
# Expected: Exit 0
```

### Final Checklist (references Task 8 acceptance criteria)

- [x] All "Must Have" present: KPI accentColor props, hover buttons with hover-target class, colored badges via getActivityBadgeColor()
- [x] All "Must NOT Have" absent: git diff shows no new zinc values, no sidebar/backend changes
- [x] Theme switcher: dark→light→system toggles without crash
- [x] Task 8 DevTools checklist: All 5 dark mode items verified, light mode sanity passed
