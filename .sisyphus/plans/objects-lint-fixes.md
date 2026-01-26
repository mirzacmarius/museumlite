# Objects Page Lint Fixes

## Context

### Original Request
Fix 7 lint errors found in `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` after accessions page redesign verification.

### Lint Errors Identified
From `bun run lint` output:

1. **Line 136**: `Promise<any>` type - should use proper type
2. **Line 385**: `div` without children should be self-closing
3. **Line 774**: `th` without children should be self-closing
4. **Line 396**: Button missing `type` prop
5. **Line 409**: Button missing `type` prop  
6. **Line 420**: Button missing `type` prop
7. **Line 430**: Button missing `type` prop

---

## Work Objectives

### Core Objective
Fix all 7 lint errors to achieve clean lint status.

### Concrete Deliverables
- Fixed `Promise<any>` type on line 136
- Self-closing div on line 385
- Self-closing th on line 774
- Type props on 4 button elements (lines 396, 409, 420, 430)

### Definition of Done
- [x] All lint errors resolved
- [x] `bun run lint` passes with 0 errors
- [x] No functionality broken

### Must Have
- Correct TypeScript types
- Proper button types for accessibility
- Self-closing JSX elements
- Preserve all existing functionality

### Must NOT Have (Guardrails)
- Do NOT change functionality
- Do NOT add new features
- Do NOT modify logic beyond lint fixes

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun run typecheck + lint)
- **User wants tests**: Manual verification
- **Framework**: TypeScript + Biome lint

### Manual QA
- Run `bun run lint` to verify 0 errors
- Run `bun run typecheck` to ensure no type errors

---

## Task Flow

```
Task 1 (Type Fix) → Task 2 (Self-Closing Elements) → Task 3 (Button Types) → Task 4 (Verify)
```

---

## TODOs

- [x] 1. Fix Promise<any> type on line 136

  **What to do**:
  - Change `() => Promise<any>` to `() => Promise<void>` in CollectionFiltersAndList props
  - The export function doesn't return a value, so void is appropriate
  
  **Must NOT do**:
  - Change the function signature or remove the prop
  - Modify the export function implementation
  
  **Parallelizable**: NO (sequential fixes)

  **References**:
  - Line 136: `onExport: () => Promise<any>;`
  - Biome error: "Unexpected any. Specify a different type."
  
  **Acceptance Criteria**:
  - [x] Type changed to `Promise<Record<string, unknown>[] | undefined>` (ALREADY FIXED)
  - [x] `lsp_diagnostics` clean on file

  **Commit**: YES
  - Message: `fix(objects): replace Promise<any> with Promise<void> for export function`
  - Files: `objects/page.tsx`
  - **STATUS**: ALREADY COMPLETED IN PREVIOUS SESSION

- [x] 2. Fix self-closing elements

  **What to do**:
  - Line 385: Change `<div className="h-4 w-px bg-zinc-800"></div>` to `<div className="h-4 w-px bg-zinc-800" />`
  - Line 774: Change `<th className="..."></th>` to `<th className="..." />`
  
  **Must NOT do**:
  - Remove or add any other attributes
  - Change the class names
  
  **Parallelizable**: NO (sequential fixes)
  
  **References**:
  - Line 385: Empty div element
  - Line 774: Empty th element
  - Biome error: "JSX elements without children should be marked as self-closing"
  
  **Acceptance Criteria**:
  - [x] Both elements use self-closing syntax (ALREADY FIXED)
  - [x] `lsp_diagnostics` clean on file

  **Commit**: YES
  - Message: `fix(objects): convert empty JSX elements to self-closing syntax`
  - Files: `objects/page.tsx`
  - **STATUS**: ALREADY COMPLETED IN PREVIOUS SESSION

- [x] 3. Add type props to buttons

  **What to do**:
  - Line 396: Add `type="button"` to filter toggle button
  - Line 409: Add `type="button"` to clear filters button  
  - Line 420: Add `type="button"` to list view button
  - Line 430: Add `type="button"` to grid view button
  
  **Must NOT do**:
  - Change any button functionality
  - Modify onClick handlers
  - Change any other button attributes
  
  **Parallelizable**: NO (all in same file)
  
  **References**:
  - Lines 396, 409, 420, 430: Button elements without type prop
  - Biome error: "Provide an explicit type prop for button element"
  
  **Acceptance Criteria**:
  - [x] All 4 buttons have `type="button"` (ALREADY FIXED - lines 397, 411, 423, 434)
  - [x] `lsp_diagnostics` clean on file

  **Commit**: YES
  - Message: `fix(objects): add type="button" to all button elements`
  - Files: `objects/page.tsx`
  - **STATUS**: ALREADY COMPLETED IN PREVIOUS SESSION

- [x] 4. Verify all fixes

  **What to do**:
  - Run `bun run lint` → Expected: 0 errors
  - Run `bun run typecheck` → Expected: 0 errors
  
  **Parallelizable**: NO (final verification)
  
  **Acceptance Criteria**:
  - [x] `bun run lint` → "Tasks: 6 successful, 6 total" ✅ VERIFIED
  - [x] `bun run typecheck` → "Tasks: 6 successful, 6 total" ✅ VERIFIED

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(objects): replace Promise<any> with Promise<void> for export function` | objects/page.tsx | lsp_diagnostics |
| 2 | `fix(objects): convert empty JSX elements to self-closing syntax` | objects/page.tsx | lsp_diagnostics |
| 3 | `fix(objects): add type="button" to all button elements` | objects/page.tsx | lsp_diagnostics |
| 4 | - | - | bun run lint + typecheck |

---

## Success Criteria

### Verification Commands
```bash
bun run lint       # Expected: 0 errors
bun run typecheck  # Expected: 0 errors
```

### Final Checklist
- [x] Promise<void> type used (actually Promise<Record<string, unknown>[] | undefined>)
- [x] All empty elements self-closing
- [x] All buttons have type="button"
- [x] Lint passes cleanly
- [x] TypeScript passes cleanly