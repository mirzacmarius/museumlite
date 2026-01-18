# Phase 3: Page Migration Strategy

## Status
Starting Phase 3 - Tasks 5-18 (14 page migration tasks)

## Approach
For each module migration:
1. Read the page file(s) to identify hardcoded strings
2. Add missing keys to all 4 locale files (en, fr, es, no)
3. Update page to use `useScopedI18n` hooks
4. Replace all hardcoded strings with `t("key")` calls
5. Verify with grep pattern (no hardcoded strings remain)
6. Commit

## Current Task
Tasks 10-12: Accessions, Deaccessions, Locations (parallel execution)

## Completed Tasks
✅ Task 1: Norwegian locale file
✅ Task 2: Config files updated
✅ Task 3: Language switcher
✅ Task 4: Common namespace added
✅ Task 5: Dashboard home page
✅ Task 6: Activity module
✅ Task 7: Loans module  
✅ Task 8: Collections module
✅ Task 9: Objects module (core pages)

## In Progress
⏳ Task 10: Accessions (agent working)
⏳ Task 11: Deaccessions (agent working)
⏳ Task 12: Locations (agent working)

## Files to migrate:
- apps/app/src/app/[locale]/(dashboard)/page.tsx
- apps/app/src/app/[locale]/(dashboard)/_components/assignments-queue.tsx
- apps/app/src/app/[locale]/(dashboard)/_components/new-arrivals-feed.tsx
