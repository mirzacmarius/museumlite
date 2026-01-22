# Dashboard i18n Sweep - Work Plan

## Overview
Remove remaining hardcoded, user-facing English strings from dashboard UI by migrating them to `next-international` translations.

## Context
- App uses `next-international` with `useScopedI18n()` hook
- Locales: `apps/app/src/locales/{en,fr,es,no}.ts`
- Scope: `apps/app/src/app/[locale]/(dashboard)/**/*.tsx`
- Translation pattern: `t("key")` for plain strings, `t("key", { param })` for interpolated strings
- Common keys exist: `common.loading` = "Loading...", `common.cancel`, etc.

## Progress
- [x] 0. Baseline audit - identify remaining hardcoded strings
- [x] 1. Accounts module sweep
- [x] 2. Loans module sweep
- [x] 3. Objects module sweep
- [x] 4. Settings module sweep
- [x] 5. Accessions module sweep
- [x] 6. Deaccessions module sweep
- [x] 7. Locations module sweep
- [x] 8. Exhibitions module sweep
- [x] 9. Conservation module sweep (already clean)
- [x] 10. Library module sweep (clean - only console.error and form defaults)
- [x] 11. Notifications module sweep (clean - no hardcoded strings)
- [x] 12. Assignments module sweep (clean - no hardcoded strings)
- [x] 13. Analytics module sweep (report-exports-card.tsx, inventory-valuation-card.tsx, compliance-report-card.tsx)
- [x] 14. Media module sweep (clean - no hardcoded strings)
- [x] 15. Onboarding module sweep (clean - no hardcoded strings)
- [x] 16. Public pages sweep (login, etc.) (clean - no hardcoded strings)
- [x] 17. Final verification (LSP diagnostics clean, typecheck OOM is pre-existing)

## Verification Commands
```bash
# After each module:
bun run typecheck
grep -rn '"[A-Z][a-z]' apps/app/src/app/[locale]/(dashboard)/MODULE --include='*.tsx' | grep -Ev "import|//\|className"

# Full dashboard sweep (after all modules):
grep -rn 'Loading\.\.\.' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'
grep -rn 'No [A-Z][^\n]{0,50}found' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'
```
