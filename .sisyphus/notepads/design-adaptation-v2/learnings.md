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
