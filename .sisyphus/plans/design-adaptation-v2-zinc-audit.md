# Zinc Audit - Design Adaptation v2

**Generated**: 2026-01-25T11:32:02.237Z
**Total Occurrences**: 38 matches in 11 files

---

## Summary by Category

| Category | Files | Occurrences | Action |
|----------|-------|-------------|--------|
| **PRINT DIALOGS** (EXEMPT) | 1 | 14 | Mark as `[PRINT-EXEMPT]` - keep for PDF output |
| **LOCATIONS** | 1 | 13 | Migrate to CSS variables |
| **BUTTONS** | 6 | 6 | Migrate to CSS variables |
| **STATUS BADGES** | 1 | 2 | Migrate to CSS variables |
| **SETTINGS** | 1 | 2 | Migrate to CSS variables |
| **REGULAR UI** | 1 | 1 | Migrate to CSS variables |

**Total to Migrate**: 24 occurrences
**Total Exempt**: 14 occurrences

---

## Detailed Inventory

### 1. PRINT DIALOGS - [PRINT-EXEMPT] (14 occurrences)

**File**: `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx`

These are intentionally light-themed for PDF/print output. **DO NOT MIGRATE**.

| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 374 | `bg-zinc-50` | DialogContent wrapper | **[PRINT-EXEMPT]** |
| 385 | `bg-zinc-100/50` | Print preview background | **[PRINT-EXEMPT]** |
| 388 | `text-zinc-900` | Print paper text | **[PRINT-EXEMPT]** |
| 390 | `border-zinc-200` | Print header border | **[PRINT-EXEMPT]** |
| 400 | `text-zinc-900` | Manifest title | **[PRINT-EXEMPT]** |
| 413 | `bg-zinc-50` | Info box background | **[PRINT-EXEMPT]** |
| 413 | `border-zinc-100` | Info box border | **[PRINT-EXEMPT]** |
| 415 | `text-zinc-900` | Section heading (Lender) | **[PRINT-EXEMPT]** |
| 421 | `text-zinc-900` | Section heading (Borrower) | **[PRINT-EXEMPT]** |
| 434 | `text-zinc-900` | Table header text | **[PRINT-EXEMPT]** |
| 434 | `border-zinc-100` | Table header border | **[PRINT-EXEMPT]** |
| 439 | `border-zinc-200` | Table row border | **[PRINT-EXEMPT]** |
| 445 | `divide-zinc-100` | Table body dividers | **[PRINT-EXEMPT]** |
| 461 | `border-zinc-200` | Signature section border | **[PRINT-EXEMPT]** |
| 463 | `border-zinc-300` | Signature line | **[PRINT-EXEMPT]** |
| 469 | `border-zinc-300` | Signature line | **[PRINT-EXEMPT]** |

**Action**: Add `{/* [PRINT-EXEMPT] */}` comments to these lines.

---

### 2. LOCATIONS PAGE (13 occurrences)

**File**: `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx`

| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 300 | `from-zinc-950` | Gradient background start | `from-background` |
| 300 | `to-zinc-900/50` | Gradient background end | `to-card/70` or use `glass-panel` |
| 303 | `text-zinc-600` | MapPin icon color | `text-muted-foreground` |
| 305 | `text-zinc-500` | Empty state text | `text-muted-foreground` |
| 306 | `text-zinc-600` | Empty state subtext | `text-muted-foreground` |
| 318 | `text-zinc-500` | Breadcrumb text | `text-muted-foreground` |
| 323 | `text-zinc-100` | Location title | `text-foreground` |
| 372 | `text-zinc-300` | Section heading | `text-foreground` |
| 381 | `text-zinc-300` | Section heading | `text-foreground` |
| 384 | `text-zinc-500` | Metadata text | `text-muted-foreground` |
| 386 | `text-zinc-300` | Metadata value | `text-foreground` |
| 402 | `text-zinc-400` | Item code | `text-muted-foreground` |
| 412 | `bg-zinc-500` | Neutral indicator | `bg-slate-500` (per previous plan) |
| 428 | `text-zinc-500` | Item type text | `text-muted-foreground` |

---

### 3. BUTTON STYLING (6 occurrences)

Light-themed buttons that should use design system variants.

#### Conservation Pages (3 files)

**File**: `apps/app/src/app/[locale]/(dashboard)/conservation/page.tsx`
| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 79 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900` | "New Treatment" button | `bg-primary text-primary-foreground hover:bg-primary/90` |

**File**: `apps/app/src/app/[locale]/(dashboard)/conservation/[id]/edit/page.tsx`
| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 261 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200` | "Save Changes" button | `bg-primary text-primary-foreground hover:bg-primary/90` |

**File**: `apps/app/src/app/[locale]/(dashboard)/conservation/new/page.tsx`
| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 238 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200` | "Create Record" button | `bg-primary text-primary-foreground hover:bg-primary/90` |

#### Exhibitions Pages (3 files)

**File**: `apps/app/src/app/[locale]/(dashboard)/exhibitions/[id]/page.tsx`
| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 562 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200` | "Upload" button | `bg-primary text-primary-foreground hover:bg-primary/90` |

**File**: `apps/app/src/app/[locale]/(dashboard)/exhibitions/[id]/edit/page.tsx`
| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 355 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900` | "Save" button | `bg-primary text-primary-foreground hover:bg-primary/90` |

**File**: `apps/app/src/app/[locale]/(dashboard)/exhibitions/new/page.tsx`
| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 331 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900` | "Create Exhibition" button | `bg-primary text-primary-foreground hover:bg-primary/90` |

---

### 4. STATUS BADGES (2 occurrences)

**File**: `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/loans-tab.tsx`

| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 63 | `border border-zinc-500/20 bg-zinc-500/10 text-zinc-400` | Returned loan status | `badge-neutral` class or `bg-muted/50 text-muted-foreground border-border` |
| 64 | `border border-zinc-500/20 bg-zinc-500/10 text-zinc-400` | Default loan status | `badge-neutral` class or `bg-muted/50 text-muted-foreground border-border` |

---

### 5. SETTINGS PAGE (2 occurrences)

**File**: `apps/app/src/app/[locale]/(dashboard)/settings/workflows/page.tsx`

| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 469 | `data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900` | Checkbox checked state | `data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground` |
| 495 | `bg-zinc-100 text-zinc-900 hover:bg-zinc-200` | Save button | `bg-primary text-primary-foreground hover:bg-primary/90` |

**NOTE**: Settings pages are marked as OUT OF SCOPE in plan guardrails. These should be **DOCUMENTED but NOT MODIFIED**.

---

### 6. REGULAR UI (1 occurrence)

**File**: `apps/app/src/app/[locale]/(dashboard)/loans/[id]/_components/overview-tab.tsx`

| Line | Pattern | Context | Replacement |
|------|---------|---------|-------------|
| 186 | `bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400` | Document type icon fallback | `bg-muted text-muted-foreground` |

---

## Migration Map Table

| Zinc Class | CSS Variable | Example Usage |
|------------|--------------|---------------|
| `bg-zinc-950` | `bg-background` | Page backgrounds |
| `bg-zinc-900` | `bg-card` | Card backgrounds |
| `bg-zinc-900/40` | `bg-card/70` or `glass-panel` | Transparent cards |
| `bg-zinc-800` | `bg-muted` | Muted backgrounds |
| `bg-zinc-500` | `bg-slate-500` | Neutral indicators (per v1 plan) |
| `bg-zinc-100` | `bg-primary` (for buttons) or `bg-muted` (for backgrounds) | Light backgrounds |
| `bg-zinc-50` | `bg-secondary` or `bg-muted` | Very light backgrounds |
| `border-zinc-800` | `border-border` | Borders |
| `border-zinc-700` | `border-border` | Borders |
| `border-zinc-500/20` | `border-border` | Subtle borders |
| `text-zinc-400` | `text-muted-foreground` | Secondary text |
| `text-zinc-300` | `text-foreground` | Primary text (lighter) |
| `text-zinc-200` | `text-foreground` | Primary text |
| `text-zinc-100` | `text-foreground` | Primary text (lightest) |
| `text-zinc-900` | `text-primary-foreground` (for buttons) | Dark text on light bg |
| `text-zinc-600` | `text-muted-foreground` | Muted text |
| `text-zinc-500` | `text-muted-foreground` | Muted text |

---

## Files Requiring Changes (by Priority)

### High Priority (Most Occurrences)
1. **locations/page.tsx** - 13 occurrences
2. **loans/[id]/page.tsx** - 14 occurrences (but all PRINT-EXEMPT)

### Medium Priority (Buttons - Consistent Pattern)
3. **conservation/page.tsx** - 1 occurrence
4. **conservation/[id]/edit/page.tsx** - 1 occurrence
5. **conservation/new/page.tsx** - 1 occurrence
6. **exhibitions/[id]/page.tsx** - 1 occurrence
7. **exhibitions/[id]/edit/page.tsx** - 1 occurrence
8. **exhibitions/new/page.tsx** - 1 occurrence

### Low Priority (Single Occurrences)
9. **objects/[id]/_components/loans-tab.tsx** - 2 occurrences
10. **loans/[id]/_components/overview-tab.tsx** - 1 occurrence

### OUT OF SCOPE (Settings)
11. **settings/workflows/page.tsx** - 2 occurrences (DOCUMENT ONLY)

---

## Acceptance Criteria Met

- [x] Full zinc audit document created (file, line, pattern, replacement)
- [x] Print dialogs identified and marked as exempt (14 occurrences in loans/[id]/page.tsx)
- [x] Migration map table completed
- [x] All 38 occurrences accounted for (14 exempt + 24 to migrate)

---

## Next Steps

1. **Task 1.2**: Use this audit to guide sidebar restructure (no zinc in sidebar currently)
2. **Task 3.3**: Use locations section (13 occurrences) during locations page styling
3. **Task 3.4**: Mark print dialogs as exempt during loans page styling
4. **Task 4.1-4.2**: Use button patterns during exhibitions/conservation styling
5. **Task 6.4**: Final verification - ensure only print-exempt zinc values remain
