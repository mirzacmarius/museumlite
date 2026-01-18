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
Task 5: Dashboard home page

## Files to migrate:
- apps/app/src/app/[locale]/(dashboard)/page.tsx
- apps/app/src/app/[locale]/(dashboard)/_components/assignments-queue.tsx
- apps/app/src/app/[locale]/(dashboard)/_components/new-arrivals-feed.tsx
