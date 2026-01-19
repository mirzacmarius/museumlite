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
