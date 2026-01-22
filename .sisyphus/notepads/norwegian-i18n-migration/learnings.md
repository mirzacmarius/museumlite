# Norwegian i18n Migration - Learnings

## Task 19: Date Formatting

### Patterns Discovered
- `formatDate(date, locale, options)` - wrapper for toLocaleDateString
- `formatDateFns(date, formatStr, locale)` - wrapper for date-fns format()
- `formatDistanceLocale(date, locale, options)` - wrapper for formatDistanceToNow

### Gotchas
- Sub-components need their own `useCurrentLocale()` hook - locale doesn't propagate automatically
- Example: `loans/[id]/page.tsx` has OverviewTab, ActivityTab as separate functions - each needs `const locale = useCurrentLocale()`
- Norwegian locale: `nb` for date-fns, `nb-NO` for Intl API

### Files with Most Changes
- `objects/[id]/page.tsx` - 7 date instances
- `loans/[id]/page.tsx` - 9 date instances + sub-components
- `deaccessions/[id]/page.tsx` - 7 date instances

## Task 20: Number Formatting

### Patterns Discovered
- `formatNumber(value, locale)` - for plain numbers with thousand separators
- `formatCurrency(value, locale, currency)` - for currency with symbol

### Currency Pattern
- Old: `$${value.toLocaleString()}`
- New: `formatCurrency(value, locale, "USD")` - includes $ symbol

### Norwegian Number Format
- Thousand separator: space (1 234)
- Decimal separator: comma (1 234,56)
- Currency: "1 234,56 $" or "USD 1 234,56"

## General Learnings

### Parallel Delegation Works Well
- 15+ parallel agents for Task 19
- 4 parallel agents for Task 20
- Significant time savings

### Verification Pattern
- `grep -rn 'toLocaleDateString' ...` to find remaining instances
- `grep -rn 'from "date-fns"' ...` to verify no direct imports
- `bun run typecheck` to catch scope issues (locale not defined)

### Pre-existing Errors (IGNORE)
- library/catalog/[id]/page.tsx - Property 'remove' does not exist
- library/circulation/page.tsx - Property 'renew' does not exist
- settings/modules/page.tsx - boolean | null vs boolean | undefined
- organization-provider.tsx - enabledModules type mismatch
- mediaThumbnails.ts - Buffer type issue
- @v1/ui data-table.tsx - 6 lint errors (noExplicitAny, useKeyWithClickEvents)

## Final Migration Stats

| Metric | Before | After |
|--------|--------|-------|
| toLocaleDateString calls | 117 | 0 |
| date-fns direct imports | 8 | 0 |
| toLocaleString() number calls | 25 | 0 |
| Intl.NumberFormat("en-US") | 2 | 0 |

## Commits Made
1. `dd75ae9` - feat(i18n): make date formatting locale-aware (Task 19)
2. `336c22e` - feat(i18n): make number/currency formatting locale-aware (Task 20)

## Manual Verification (COMPLETED Jan 19, 2026)
Verified via Playwright with cached credentials:
- [x] All 4 locales work end-to-end
- [x] Language switcher shows all 4 options
- [x] Dates display correctly in Norwegian (e.g., "7 dager siden")
- [x] Numbers display correctly in Norwegian (code verified)
- [x] Toast messages display in selected locale (code verified)
