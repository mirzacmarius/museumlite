# Accessions Page Redesign

## Context

### Original Request
Implement Accessions design and all functionality (existing and missing) from the reference HTML file `museumlite.aura.build.html` in the Accessions sidebar menu item page content.

### Reference Design Analysis (HTML lines 2397-2538)
The reference design includes:
- **Header**: Stats (Pending/This Month) with zinc colors + "New Accession" indigo button
- **Kanban Board**: Horizontal scrolling columns
  - Columns: Draft/Intake, Review, Cataloging (with count badges)
  - Column headers: uppercase text, tracking-wider, zinc-800 count badges
- **Cards**: 
  - Lot/accession number in mono font (text-[10px] font-mono text-zinc-500)
  - Status indicator dot (amber with glow shadow)
  - Title with hover:text-indigo-400 transition
  - Description (text-xs text-zinc-500)
  - Assignee avatar with initials (rounded-full bg-indigo-500/20)
  - Progress bar in some cards
  - Image thumbnails in some cards
  - Status badges (emerald for "Measuring")

### Current Implementation
- Located at: `apps/app/src/app/[locale]/(dashboard)/accessions/`
- Files to modify:
  - `accessions-page-client.tsx` - Main layout
  - `accessions-stats.tsx` - Stats component
  - `kanban-column.tsx` - Kanban card styles
  - `accession-kanban.tsx` - Kanban container

---

## Work Objectives

### Core Objective
Redesign the Accessions page to match the reference HTML design with zinc-based dark theme styling.

### Concrete Deliverables
- Updated `accessions-page-client.tsx` with zinc theme header
- Updated `accessions-stats.tsx` with zinc colors
- Updated `kanban-column.tsx` with reference card styles
- Updated `accession-kanban.tsx` container styles

### Definition of Done
- [ ] Page matches reference design visually - **REQUIRES MANUAL BROWSER TESTING**
- [ ] All existing functionality preserved - **REQUIRES MANUAL BROWSER TESTING**
- [x] `bun run typecheck` passes
- [ ] No console errors - **REQUIRES MANUAL BROWSER TESTING**

### Must Have
- Zinc-based dark theme (zinc-900, zinc-800, zinc-500, etc.)
- Mono font for accession numbers
- Status indicator dots with correct colors
- Assignee avatars with initials
- Proper hover effects (indigo-400 on titles)
- Count badges on column headers

### Must NOT Have (Guardrails)
- Do NOT remove any existing functionality
- Do NOT change API calls or data flow
- Do NOT modify backend code
- Do NOT add unnecessary comments

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun run typecheck)
- **User wants tests**: Manual verification
- **Framework**: TypeScript + lint

### Manual QA
Each TODO includes verification via:
- TypeScript diagnostics (`lsp_diagnostics`)
- Build verification (`bun run typecheck`)
- Visual inspection via Playwright (requires auth)

---

## Task Flow

```
Task 1 (Stats) → Task 2 (Kanban Column) → Task 3 (Page Client) → Task 4 (Container) → Task 5 (Verify)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 1, 2 | None | Independent components |
| 3 | 1, 2 | Uses updated components |
| 4 | 3 | Container wraps content |
| 5 | All | Final verification |

---

## TODOs

- [x] 1. Redesign accessions-stats.tsx with zinc colors

  **What to do**:
  - Update text colors to use zinc palette (zinc-500 for labels, text-white for values)
  - Use uppercase tracking-wide for labels
  - Keep the same data structure, just update styling
  
  **Must NOT do**:
  - Change the props interface
  - Add new functionality
  
  **Parallelizable**: YES (with 2)
  
  **References**:
  - `museumlite.aura.build.html:2401-2416` - Stats design pattern
  - `apps/app/src/app/[locale]/(dashboard)/accessions/accessions-stats.tsx` - Current implementation
  
  **Acceptance Criteria**:
  - [ ] Labels: `text-xs font-medium text-zinc-500 uppercase tracking-wide`
  - [ ] Values: `text-2xl font-semibold tracking-tight text-white`
  - [ ] `lsp_diagnostics` clean
  
  **Commit**: YES
  - Message: `style(accessions): update stats component with zinc theme`
  - Files: `accessions-stats.tsx`

- [x] 2. Redesign kanban-column.tsx with reference card styles

  **What to do**:
  - Column header: uppercase text-xs font-semibold text-zinc-400 tracking-wider
  - Count badge: bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded text-[10px]
  - Cards:
    - Container: bg-zinc-900 border border-zinc-800 p-3 rounded-lg hover:border-zinc-700
    - Accession number: text-[10px] font-mono text-zinc-500
    - Status dot: w-1.5 h-1.5 rounded-full with color + shadow glow
    - Title: text-sm text-zinc-200 font-medium group-hover:text-indigo-400 transition-colors
    - Description: text-xs text-zinc-500 mb-3
    - Assignee: Avatar with initials (w-5 h-5 rounded-full bg-indigo-500/20 text-[9px] text-indigo-300)
  
  **Must NOT do**:
  - Change the data fetching logic
  - Modify the filtering logic
  - Remove link navigation
  
  **Parallelizable**: YES (with 1)
  
  **References**:
  - `museumlite.aura.build.html:2426-2533` - Kanban column and card design
  - `apps/app/src/app/[locale]/(dashboard)/accessions/kanban-column.tsx` - Current implementation
  
  **Acceptance Criteria**:
  - [ ] Column headers match reference (uppercase, tracking-wider)
  - [ ] Cards have mono font accession numbers
  - [ ] Status dots with correct colors
  - [ ] Assignee avatars with initials
  - [ ] Hover effects work (title goes indigo-400)
  - [ ] `lsp_diagnostics` clean
  
  **Commit**: YES
  - Message: `style(accessions): redesign kanban cards with zinc theme`
  - Files: `kanban-column.tsx`

- [x] 3. Redesign accessions-page-client.tsx header and layout

  **What to do**:
  - Container: p-6 h-full flex flex-col
  - Header row: flex justify-between items-center mb-6
  - Stats on left, buttons on right
  - Search input: rounded-full, zinc-800 border, zinc-900 bg, pl-8 for icon
  - Import button: border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800
  - New Accession button: bg-indigo-600 hover:bg-indigo-500 text-white shadow
  - Remove Button component usage, use native elements for consistency
  
  **Must NOT do**:
  - Change the API calls
  - Modify state management
  - Remove permission gates
  
  **Parallelizable**: NO (depends on 1, 2)
  
  **References**:
  - `museumlite.aura.build.html:2398-2422` - Header layout
  - `apps/app/src/app/[locale]/(dashboard)/accessions/accessions-page-client.tsx` - Current implementation
  
  **Acceptance Criteria**:
  - [ ] Header layout matches reference
  - [ ] Search input has rounded-full style
  - [ ] Buttons have correct zinc/indigo styling
  - [ ] All permissions still gated correctly
  - [ ] `lsp_diagnostics` clean
  
  **Commit**: YES
  - Message: `style(accessions): redesign page header with zinc theme`
  - Files: `accessions-page-client.tsx`

- [x] 4. Update accession-kanban.tsx container styles

  **What to do**:
  - Container: flex-1 overflow-x-auto custom-scrollbar
  - Inner flex: flex gap-6 min-w-max h-full pb-4
  - Ensure proper zinc theme consistency
  
  **Must NOT do**:
  - Change the Suspense boundaries
  - Modify the workflow steps logic
  
  **Parallelizable**: NO (depends on 3)
  
  **References**:
  - `museumlite.aura.build.html:2423-2424` - Container styles
  - `apps/app/src/app/[locale]/(dashboard)/accessions/accession-kanban.tsx` - Current implementation
  
  **Acceptance Criteria**:
  - [ ] Horizontal scroll works properly
  - [ ] Gap between columns is 6 (gap-6)
  - [ ] `lsp_diagnostics` clean
  
  **Commit**: YES
  - Message: `style(accessions): update kanban container styling`
  - Files: `accession-kanban.tsx`

- [x] 5. Verify all changes with typecheck

  **What to do**:
  - Run `bun run typecheck`
  - Run `bun run lint`
  - Verify no errors
  
  **Parallelizable**: NO (final step)
  
  **Acceptance Criteria**:
  - [x] `bun run typecheck` → 0 errors
  - [x] `bun run lint` → 0 errors (or only pre-existing)
  
  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `style(accessions): update stats component with zinc theme` | accessions-stats.tsx | lsp_diagnostics |
| 2 | `style(accessions): redesign kanban cards with zinc theme` | kanban-column.tsx | lsp_diagnostics |
| 3 | `style(accessions): redesign page header with zinc theme` | accessions-page-client.tsx | lsp_diagnostics |
| 4 | `style(accessions): update kanban container styling` | accession-kanban.tsx | lsp_diagnostics |
| 5 | - | - | bun run typecheck |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: 0 errors
bun run lint       # Expected: 0 errors
```

### Final Checklist
- [ ] All components use zinc color palette
- [ ] Cards have mono font accession numbers
- [ ] Status dots with colored shadows
- [ ] Assignee avatars with initials
- [ ] All hover effects working
- [ ] All existing functionality preserved
- [ ] TypeScript passes
