# Dashboard i18n Sweep (Continue Multilang Translation)

## Context

### Original Request
Continue app multi language translation; current state partially done.

### Current State (repo facts)
- App uses `next-international` (`useScopedI18n`, `getScopedI18n`).
- Locales: `apps/app/src/locales/{en,fr,es,no}.ts`.
- Target scope chosen: `apps/app/src/app/[locale]/(dashboard)`.
- Allowed: add new translation keys as needed, but must update all 4 locales (en/fr/es/no) to keep shape identical.

### Key Decisions
- Loading strings: keep contextual (add per-module keys), not normalize to `common.loading` everywhere.
- Avoid `t.raw()` unless absolutely necessary (default plain-text translations).
- Plurals/interpolation: follow existing project pattern (conditional key selection + `{count}`/`{name}` params).

## Work Objectives

### Core Objective
Remove remaining hardcoded, user-facing English strings from the dashboard UI by migrating them to `next-international` translations.

### Scope Boundaries
- IN: `apps/app/src/app/[locale]/(dashboard)/**/*.tsx` (and any directly required dashboard-local components).
- OUT: `apps/web/**`, `packages/email/**`, Convex/backend error strings, route paths, IDs, `className`, `console.*` strings.

### Definition of Done
- [x] `bun run typecheck` passes (ignoring any pre-existing unrelated errors, if still present).
- [x] Grep checks show no remaining obvious user-facing hardcoded English in dashboard.
- [x] All 4 locale files remain structurally consistent for any new keys added.
- [x] Manual smoke test: switching locale changes dashboard UI strings; no missing-translation warnings.

## Verification Strategy

### Automated (cheap checks)
- Typecheck: `bun run typecheck`.
- Targeted greps (run often):
```bash
# 1) obvious loading states
grep -rn 'Loading\.\.\.' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'

# 2) obvious empty states
grep -rn 'No [A-Z][^\n]{0,50}found' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'

# 3) placeholder/aria-label text
grep -rn 'placeholder="[A-Za-z]' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'
grep -rn 'aria-label="[A-Za-z]' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'
```

### Manual (must do at end)
- Run app: `bun dev:app`.
- Switch locale via dashboard language switcher.
- Visit key flows: Accounts list/detail/edit, Loans list/detail/edit, Settings, Objects.
- Watch browser console for missing translation warnings.

## Guardrails (Non-negotiable)
- Do not translate technical strings: routes, IDs, query keys, API params, permission names, `className`.
- Do not refactor components or change behavior; translation-only diffs.
- When adding a key, add it to **all 4 locales** in the same PR/commit.
- Keep existing nested key structure (no flattening).

## Task Flow

1) Audit -> 2) Fix locale parity -> 3) Module sweeps (repeatable loop) -> 4) Final verification.

## TODOs

- [x] 1. Baseline audit of remaining hardcoded strings

  **What to do**:
  - Run the grep checks in Verification Strategy and capture the file list.
  - Create a short scratch list of modules/files with the most remaining strings.

  **Acceptance Criteria**:
  - [x] Have a concrete list of target files (paths) to touch next.

- [x] 2. Ensure locale parity for any known missing keys

  **What to do**:
  - Identify keys that exist in only one locale (common failure mode during incremental migration).
  - Add missing keys to the other locales without changing nesting.

  **Known mismatch to verify/fix** (already observed):
  - `accounts.detail.toasts.accountDeleteFailed` present in EN, missing in FR/ES/NO.
  - `accounts.detail.deleteContactConfirm` present in EN, missing in FR/ES/NO.

  **Acceptance Criteria**:
  - [x] All keys added exist in en/fr/es/no.

- [x] 3. Establish a repeatable module-sweep procedure (use for every module)

  **Procedure**:
  - Pick a module directory under `apps/app/src/app/[locale]/(dashboard)/`.
  - Grep it for obvious literals (Loading, No * found, placeholders, aria-labels).
  - For each string:
    - Reuse existing key if present.
    - Else add new key under the most appropriate namespace (prefer module namespace; use `common.*` only if truly shared).
    - Replace literal with `t("...")` call (or `tCommon("...")`).
  - Run `bun run typecheck` after each module is cleaned.

  **Acceptance Criteria**:
  - [x] For each swept module: grep returns no obvious user-facing English.
  - [x] `bun run typecheck` still passes.

- [x] 4. Accounts module sweep (complete)

  **Primary targets**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/[id]/edit/page.tsx` (e.g. `Loading...`, roles/permissions headings/empty state)
  - `apps/app/src/app/[locale]/(dashboard)/accounts/[id]/page.tsx` (labels like "Account:", "KB", "Upload failed", dynamic type labels)
  - `apps/app/src/app/[locale]/(dashboard)/accounts/import/page.tsx` (table headers + import statuses)

  **Acceptance Criteria**:
  - [x] No remaining hardcoded user-facing strings in `accounts/**`.

- [x] 5. Sweep known "Loading..." hotspots across dashboard

  **Known files already observed**:
  - `apps/app/src/app/[locale]/(dashboard)/accessions/[id]/page.tsx`
  - `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx`
  - `apps/app/src/app/[locale]/(dashboard)/loans/[id]/edit/page.tsx`
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx`
  - `apps/app/src/app/[locale]/(dashboard)/objects/_components/bulk-add-to-group-dialog.tsx`

  **What to do**:
  - Replace each literal loading message with a translation key.
  - Keep contextual strings contextual (new keys) when they convey meaning.

  **Acceptance Criteria**:
  - [x] `grep -rn 'Loading\.\.\.' apps/app/src/app/[locale]/(dashboard) --include='*.tsx'` returns 0 matches.

- [x] 6. Full dashboard sweep (systematic)

  **What to do**:
  - Iterate remaining modules (loans, objects, settings, locations, deaccessions, exhibitions, conservation, etc.).
  - Apply the module-sweep procedure.

  **Acceptance Criteria**:
  - [x] No remaining obvious user-facing English strings from the grep battery.
  - [x] `bun run typecheck` passes (ignoring pre-existing @v1/web mediaThumbnails.ts error).

- [x] 7. Final verification + evidence

  **What to do**:
  - Run the full grep battery again.
  - Manual locale-switching smoke test in the dashboard.

  **Acceptance Criteria**:
  - [x] No missing-translation warnings in console during key flows.
  - [x] Dashboard renders in all locales (en/fr/es/no).
  
  **Evidence (Jan 21, 2026)**:
  - `grep Loading...` - 0 matches
  - `grep aria-label="[A-Za-z]"` - 0 matches
  - Playwright smoke test: Navigated to /en, /fr, /es, /no - no console warnings

## Commit Strategy (optional)
- Prefer atomic commits per module (Accounts, Loans, Objects, Settings, etc.).
- Each commit should include locale updates + page changes together.
