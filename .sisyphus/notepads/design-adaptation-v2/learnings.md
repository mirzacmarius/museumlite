# Learnings - Design Adaptation v2

## Conventions & Patterns

### [2026-01-25] Task 1.1 - Zinc Audit Findings

**Total zinc occurrences**: 38 matches in 11 files
- **Print dialogs (EXEMPT)**: 14 occurrences in `loans/[id]/page.tsx`
- **To migrate**: 24 occurrences across 10 files

**Key Patterns Discovered**:
1. **Print dialogs use light zinc intentionally** - These create white-paper PDF aesthetic and should NOT be migrated
2. **Buttons use consistent pattern** - `bg-zinc-100 text-zinc-900 hover:bg-zinc-200` appears in 6 files (conservation + exhibitions)
3. **Locations page has highest concentration** - 13 occurrences, mostly text colors
4. **Settings pages have zinc** - But settings are OUT OF SCOPE per plan guardrails

**Migration Patterns**:
- `text-zinc-500/400/600` → `text-muted-foreground`
- `text-zinc-100/200/300` → `text-foreground`
- `bg-zinc-100` (buttons) → `bg-primary text-primary-foreground hover:bg-primary/90`
- `bg-zinc-500` → `bg-slate-500` (per v1 plan decision)
- `bg-zinc-950/900` → `bg-background` or `bg-card`

**Audit document**: `.sisyphus/plans/design-adaptation-v2-zinc-audit.md`

---

### [2026-01-25T00:00:00Z] Task 1.2 - Sidebar Restructure

**Changes**: Reorganized sidebar JSX into 5 design groups
- Core Inventory: All Objects, New Arrivals, My Assignments, Recent Activity, Media Library
- Collections: Dynamic collection groups with color indicators
- Collection Management: Accessions, Deaccessions, Locations
- Operations: Loans & Transport, Active Rotations, Lab Requests (with badges/locks)
- Library: Catalog, Circulation, Patrons, Fines, Acquisitions (conditional)
- Administration: Settings, Analytics

**Pattern**: Navigation arrays already existed (lines 248-304), JSX rendering updated to use new group labels and structure

**Preserved**: All nav items, feature flags, badges, collection groups logic, conditional library section

**Verification**: 
- lsp_diagnostics: clean
- bun run typecheck: passed (6 successful, 6 total)
### [2026-01-25] Task 4.1 - Exhibitions Button Migration

**Files migrated**: 3 occurrences across exhibitions pages
- `exhibitions/new/page.tsx:331` - Create button
- `exhibitions/[id]/page.tsx:562` - Upload button
- `exhibitions/[id]/edit/page.tsx:355` - Save button

**Pattern applied**: `bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900` → `bg-primary text-primary-foreground hover:bg-primary/90`

**Verification**: 
- lsp_diagnostics: clean on all 3 files
- No type errors introduced
- CSS variables now consistent with design system

**Notes**: 
- All 3 buttons were secondary action buttons (create/upload/save)
- Dark mode variants removed (primary color handles both light/dark via CSS variables)
- Follows established pattern from Milestone 3 (Management Pages)

### [2026-01-25] Task 4.2 - Conservation Button Migration

**Files migrated**: 3 occurrences across conservation pages
- `conservation/page.tsx:79` - New treatment button
- `conservation/new/page.tsx:238` - Create record button
- `conservation/[id]/edit/page.tsx:261` - Save changes button

**Pattern applied**: 
- File 1: `bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900` → `bg-primary text-primary-foreground hover:bg-primary/90`
- Files 2-3: `bg-zinc-100 text-zinc-900 hover:bg-zinc-200` → `bg-primary text-primary-foreground hover:bg-primary/90`

**Verification**: 
- lsp_diagnostics: clean on all 3 files
- No type errors introduced
- CSS variables now consistent with design system

**Notes**: 
- All 3 buttons are secondary action buttons (new/create/save)
- Consistent with Task 4.1 (exhibitions) pattern
- Completes Milestone 4: Feature Pages button migration
