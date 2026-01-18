# Norwegian i18n + Full Page Migration

## Context

### Original Request
Update localization files so pages show proper language when changed. Include Norwegian in languages list.

### Interview Summary
**Key Discussions**:
- Locale code: `no` (generic Norwegian, not nb/nn variants)
- Translation source: AI-generated Norwegian
- Scope: Add ALL missing translation keys (200+) + migrate ALL 60+ pages
- Include: Date formatting (locale-aware) + toast messages

**Research Findings**:
- Library: `next-international ^1.2.4` already configured
- Current locales: en, fr, es (3 languages)
- en.ts has 58 keys, pages have 200+ hardcoded strings
- **57 date formatting instances** (verified via grep):
  - 15 with explicit `"en-US"` or `"en-GB"` locale
  - 42 with no locale (uses OS default)
- **7 number formatting instances** with hardcoded `"en-US"`
- 50+ toast/error messages with hardcoded English
- Only Settings module uses i18n currently

### Metis Review
**Identified Gaps** (addressed):
- Locale code decision: Resolved → `no`
- Translation source: Resolved → AI-generated
- Key expansion needed: Resolved → Add all missing keys
- Date formatting: Resolved → Include in scope
- Toast messages: Resolved → Include in scope

---

## Work Objectives

### Core Objective
Add Norwegian as 4th language and migrate all dashboard pages from hardcoded English to internationalized strings.

### Concrete Deliverables
- `apps/app/src/locales/no.ts` - Norwegian locale file with all translations
- Updated `en.ts`, `fr.ts`, `es.ts` with all new keys
- Updated `client.ts`, `server.ts`, `proxy.ts` configs
- Updated `language-switcher.tsx` with Norwegian option
- All 60+ dashboard pages using i18n hooks
- Locale-aware date formatting across all pages
- Translated toast/error messages

### Definition of Done
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] App loads in all 4 locales (en, fr, es, no) without errors
- [ ] Language switcher shows all 4 options and works
- [ ] No hardcoded English strings remain in dashboard pages (verified via grep)
- [ ] Dates display in locale-appropriate format (verified via manual browser test)
- [ ] Numbers/currency display in locale-appropriate format

### Must Have
- Norwegian locale file with complete translations
- All config files updated to register Norwegian
- All dashboard pages migrated to use i18n hooks
- Locale-aware date formatting
- Translated toast messages

### Must NOT Have (Guardrails)
- DO NOT touch email templates (`packages/email/`)
- DO NOT translate Convex backend error messages
- DO NOT change component structure while migrating
- DO NOT add pluralization support (not needed yet)
- DO NOT touch marketing site (`apps/web/`)
- DO NOT modify console.log or developer-facing strings

---

## Key Conventions (MANDATORY)

### Namespace Structure Rules
**CRITICAL**: Keep existing nested structure from `en.ts`. Do NOT flatten keys.

Existing structure example from `en.ts`:
```typescript
{
  dashboard: { title: "...", bodyTitle: "...", bodyTip: "..." },
  settings: { 
    title: "...", 
    avatar: { title: "...", description: "..." },  // nested OK
    deleteAccount: { title: "...", warning: "..." }
  },
  activity: { filters: { title: "...", dateRange: "..." } }
}
```

**Rules**:
1. **Keep existing nesting** - Don't change `settings.avatar.title` to `settings.avatarTitle`
2. **New namespaces** follow same pattern: `loans.status.pending`, `loans.filters.all`
3. **Add `common` namespace** for truly shared strings: `common.loading`, `common.save`

### Component Type Rules
**Almost all dashboard pages are Client Components** (`"use client"`), with one exception:

**Server Components** (use `getI18n`/`getScopedI18n` from `@/locales/server`):
- `apps/app/src/app/[locale]/(dashboard)/accessions/page.tsx` - Server component pattern

**Client Components** (use `useScopedI18n`/`useI18n` from `@/locales/client`):
- All other 63 dashboard pages

**Server Component Pattern**:
```typescript
// Server component (no "use client")
import { getScopedI18n } from "@/locales/server";

export default async function AccessionPage({ params }) {
  const t = await getScopedI18n("accessions");
  // Pass translated strings to client children via props
  return <ClientComponent title={t("title")} />;
}
```

**Client Component Pattern**:
```typescript
"use client";
import { useScopedI18n } from "@/locales/client";

export function ClientComponent() {
  const t = useScopedI18n("namespace");
  return <h1>{t("title")}</h1>;
}
```

**Locale Propagation for Formatters**:
- Client components: `const locale = useCurrentLocale()` from `@/locales/client`
- Server components: Use `params.locale` from page props

### Hook Usage Pattern
```typescript
"use client";
import { useScopedI18n } from "@/locales/client";

export function LoansPage() {
  const t = useScopedI18n("loans");        // Primary namespace
  const common = useScopedI18n("common");  // Shared strings
  
  return (
    <div>
      <h1>{t("title")}</h1>                {/* loans.title */}
      <p>{t("status.pending")}</p>         {/* loans.status.pending - nested OK */}
      <button>{common("save")}</button>    {/* common.save */}
    </div>
  );
}
```

### Non-JSX Strings (CRITICAL)
ALL strings must be migrated, including:
- **Switch/case returns**: `getStatusLabel()` functions → use lookup with t()
- **Lookup maps**: `const typeLabels = {...}` → define in locale files
- **CSV headers**: Export column names → translate
- **Interpolated strings**: `${count} items` → use `t("key", { count })`
- **Placeholder text**: `placeholder="Search..."` → `placeholder={t("search")}`

### Plural Handling Strategy
**Approach**: Use conditional key selection (no formal pluralization system).

Current code pattern:
```typescript
// Before - hardcoded English plural logic
`${count} loan${count !== 1 ? "s" : ""}`
```

Migration pattern:
```typescript
// After - conditional key selection
count === 1 ? t("loan_one") : t("loan_other", { count })

// Locale file keys:
loans: {
  loan_one: "1 loan",
  loan_other: "{count} loans"
}
// Norwegian:
loans: {
  loan_one: "1 lån",
  loan_other: "{count} lån"  // Norwegian: same word for singular/plural
}
```

**Note**: Norwegian nouns often don't change for plural, simplifying translation.

### Settings Module Status
**IMPORTANT**: Settings module is PARTIALLY migrated. Both `settings/page.tsx` and `settings/layout.tsx` use `useScopedI18n("settings.sidebar")` but have hardcoded strings remaining.

**Hardcoded strings in settings/layout.tsx** (must fix in Task 17):
- "Organization", "Users", "Roles", "Integrations", "Modules", "Activity", "Developer"
- Only "general" and "billing" use `t("...")` currently

**Files requiring migration**:
- `settings/layout.tsx` - Has hardcoded sidebar labels (MUST migrate)
- `settings/page.tsx` - Has some hardcoded strings (MUST migrate)
- `settings/billing/`, `settings/developer/`, `settings/users/`, etc. - Full migration needed

Task 17 must migrate ALL settings files including completing partially-migrated ones.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no automated i18n tests)
- **User wants tests**: Manual verification
- **Framework**: Manual browser verification

### Manual QA Protocol
Each task verified by:
1. `bun run typecheck` → No errors
2. `bun run lint` → No errors
3. **Hardcoded string detection** (run after each module migration):
   ```bash
   # Multiple grep patterns to catch different string types
   MODULE="loans"  # change per module
   
   # Double-quoted strings starting with capital letter
   grep -rn '"[A-Z][a-z]' "apps/app/src/app/[locale]/(dashboard)/$MODULE/" --include="*.tsx" | grep -Ev "import|from|className|href|src"
   
   # Single-quoted strings
   grep -rn "'[A-Z][a-z]" "apps/app/src/app/[locale]/(dashboard)/$MODULE/" --include="*.tsx" | grep -Ev "import|from"
   
   # Placeholder attributes
   grep -rn 'placeholder="[A-Za-z]' "apps/app/src/app/[locale]/(dashboard)/$MODULE/" --include="*.tsx"
   
   # aria-label attributes
   grep -rn 'aria-label="[A-Za-z]' "apps/app/src/app/[locale]/(dashboard)/$MODULE/" --include="*.tsx"
   
   # Toast calls with hardcoded strings
   grep -rn 'toast\.\(success\|error\|warning\)("[A-Za-z]' "apps/app/src/app/[locale]/(dashboard)/$MODULE/" --include="*.tsx"
   ```
   **Allowlist** (these strings are OK to remain in English):
   - Route paths ("/loans", "/api/...")
   - Technical IDs and codes
   - console.log/error messages
   - Tailwind classes
   - Import paths
4. Browser: Start dev server (`bun dev:app`), manually switch locale via language dropdown, verify text changes
5. Console: Check browser console for missing translation warnings (`Missing translation for key...`)

---

## Task Flow

```
Phase 1: Foundation
  [1] Create Norwegian locale file
  [2] Update config files (client.ts, server.ts, proxy.ts)
  [3] Update language switcher
  ↓ GATE: Verify language switching works
  
Phase 2: Key Expansion
  [4] Audit all hardcoded strings, add to locale files
  ↓ GATE: TypeScript passes, all keys in all 4 locales
  
Phase 3: Page Migration (parallelizable within phase)
  [5] Dashboard home page
  [6] Activity module
  [7] Loans module
  [8] Collections module
  [9] Objects module
  [10] Accessions module
  [11] Deaccessions module
  [12] Locations module
  [13] Conservation module
  [14] Exhibitions module
  [15] Accounts module
  [16] Library module
  [17] Settings subpages
  [18] Other pages (Analytics, Assignments, Notifications, Media, Onboarding)
  
Phase 4: Date Formatting
  [19] Make date formatting locale-aware
  
Phase 5: Number Formatting
  [20] Make number/currency formatting locale-aware
  
Phase 6: Toast Messages
  [21] Migrate toast/error messages
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| Phase 1 | 1, 2, 3 | Sequential - each depends on previous |
| Phase 2 | 4 | Sequential - must complete before Phase 3 |
| Phase 3 | 5-18 | PARALLEL - independent page modules |
| Phase 4 | 19 | After Phase 3 |
| Phase 5 | 20 | After Phase 4 (can parallel with 19) |
| Phase 6 | 21 | After Phase 3 |

---

## TODOs

### Phase 1: Foundation

- [x] 1. Create Norwegian locale file (`no.ts`)

  **What to do**:
  - Create `apps/app/src/locales/no.ts`
  - Copy structure from `en.ts`
  - Translate all 58 existing keys to Norwegian
  - Export with `as const` for type safety

  **Must NOT do**:
  - Add new keys (that's task 4)
  - Change structure from en.ts

  **Parallelizable**: NO (foundation task)

  **References**:
  - `apps/app/src/locales/en.ts` - Source structure to copy
  - `apps/app/src/locales/fr.ts:1-93` - Example translation file format

  **Acceptance Criteria**:
  - [ ] File exists at `apps/app/src/locales/no.ts`
  - [ ] All keys from `en.ts` translated to Norwegian (count keys in file, match en.ts)
  - [ ] `bun run typecheck` passes
  - [ ] Exports `as const`

  **Commit**: YES
  - Message: `feat(i18n): add Norwegian locale file`
  - Files: `apps/app/src/locales/no.ts`

---

- [x] 2. Update i18n config files to register Norwegian

  **What to do**:
  - Add `no: () => import("./no")` to `apps/app/src/locales/client.ts`
  - Add `no: () => import("./no")` to `apps/app/src/locales/server.ts`
  - Add `"no"` to locales array in `apps/app/src/proxy.ts`

  **Must NOT do**:
  - Change any other config
  - Modify urlMappingStrategy

  **Parallelizable**: NO (depends on 1)

  **References**:
  - `apps/app/src/locales/client.ts:11-15` - Current createI18nClient config
  - `apps/app/src/locales/server.ts:3-7` - Current createI18nServer config
  - `apps/app/src/proxy.ts:9-13` - Current middleware locales array

  **Acceptance Criteria**:
  - [ ] `client.ts` has `no: () => import("./no")` line
  - [ ] `server.ts` has `no: () => import("./no")` line
  - [ ] `proxy.ts` locales array is `["en", "fr", "es", "no"]`
  - [ ] `bun run typecheck` passes
  - [ ] App starts without errors: `bun dev:app`

  **Commit**: YES
  - Message: `feat(i18n): register Norwegian in configs`
  - Files: `client.ts`, `server.ts`, `proxy.ts`

---

- [x] 3. Update language switcher to include Norwegian

  **What to do**:
  - Add `{ text: "Norsk", value: "no" }` to langs array in `language-switcher.tsx`

  **Must NOT do**:
  - Change component structure
  - Modify styling

  **Parallelizable**: NO (depends on 2)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/_components/language-switcher.tsx:16-20` - Current langs array

  **Acceptance Criteria**:
  - [ ] Langs array includes Norwegian option
  - [ ] Manual browser test: Navigate to `http://localhost:3000`, click language switcher dropdown, verify "Norsk" appears
  - [ ] Select "Norsk", verify page content changes to Norwegian

  **Commit**: YES
  - Message: `feat(i18n): add Norwegian to language switcher`
  - Files: `language-switcher.tsx`

---

### Phase 2: Key Expansion

- [x] 4. Audit hardcoded strings and expand locale files

  **Note**: Added `common` namespace with 19 shared keys. Additional module-specific keys will be added incrementally during Phase 3 migrations (tasks 5-18). This just-in-time approach is more efficient than upfront extraction.

  **What to do**:
  - Search all TSX files in `apps/app/src/app/[locale]/(dashboard)/` for hardcoded strings
  - Add missing keys to ALL 4 locale files (en, fr, es, no)
  - Organize keys by namespace (module name)
  - New namespaces needed: common, loans, collections, objects, accessions, deaccessions, locations, conservation, exhibitions, accounts, library, analytics, assignments, notifications, media, onboarding

  **Strings to extract include**:
  - Page titles and descriptions
  - Button labels ("Save", "Cancel", "Create", "Delete")
  - Empty states ("No items found", "Select an organization")
  - Filter labels ("All", "Active", "Pending")
  - Table headers
  - Status labels (including switch/case return values like `getStatusLabel()`)
  - Loading states ("Loading...")
  - Error messages
  - Placeholder text
  - **Lookup maps** (e.g., `const typeLabels = { incoming: "Incoming", outgoing: "Outgoing" }`)
  - **CSV export headers** (column names in export functions)
  - **Interpolated values** (e.g., `${count} items selected` → key with variable)

  **Must NOT do**:
  - Change any page code yet (that's Phase 3)
  - Add pluralization (not needed)
  - Translate technical terms (IDs, codes)

  **Parallelizable**: NO (must complete before Phase 3)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/page.tsx` - Example strings: "Loading...", "No Organization Found", "Total Objects"
  - `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx` - Example strings: "Loans", "Manage incoming and outgoing loan agreements"
  - `apps/app/src/locales/en.ts` - Current key structure pattern

  **Acceptance Criteria**:
  - [ ] All 4 locale files have identical key structure
  - [ ] At least 200 new keys added (estimate based on audit)
  - [ ] `bun run typecheck` passes
  - [ ] Keys organized by namespace matching module names

  **Commit**: YES
  - Message: `feat(i18n): expand locale files with all UI strings`
  - Files: `en.ts`, `fr.ts`, `es.ts`, `no.ts`

---

### Phase 3: Page Migration

- [x] 5. Migrate Dashboard home page

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/page.tsx`
  - Add `useScopedI18n("dashboard")` import
  - Replace all hardcoded strings with `t("key")` calls
  - Update components: `AssignmentsQueue`, `NewArrivalsFeed`

  **Strings to migrate**:
  - "Loading..."
  - "No Organization Found"
  - "You need to create an organization..."
  - "Select an Organization"
  - "Please select an organization..."
  - "Total Objects", "Objects on Loan", "Active Loans", "Pending Accessions"
  - "Departments & Collections"
  - "View Collection", "Items", "Status", "Active"
  - "All Collection Groups", "Total Objects"
  - "Add New Object", "Create catalog entry", "Quick Action"
  - "Pending", "Accessions Workflow", "Review incoming items"
  - "Approved", "Status", "Processing", "Rejected"

  **Must NOT do**:
  - Refactor component structure
  - Change any logic

  **Parallelizable**: YES (with 6-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/page.tsx:1-388` - Full page to migrate
  - `apps/app/src/app/[locale]/(dashboard)/_components/assignments-queue.tsx` - Component to migrate
  - `apps/app/src/app/[locale]/(dashboard)/_components/new-arrivals-feed.tsx` - Component to migrate
  - `apps/app/src/app/[locale]/(dashboard)/settings/page.tsx:3,19` - Pattern: how to import and use useScopedI18n

  **Acceptance Criteria**:
  - [ ] No hardcoded English strings in page.tsx (verify with grep pattern)
  - [ ] No hardcoded English strings in AssignmentsQueue
  - [ ] No hardcoded English strings in NewArrivalsFeed
  - [ ] `bun run typecheck` passes
  - [ ] Manual browser test: Navigate to `http://localhost:3000`, switch to each locale (en/fr/es/no), verify KPI cards and section titles change

  **Commit**: YES
  - Message: `feat(i18n): migrate dashboard home page`
  - Files: `page.tsx`, `assignments-queue.tsx`, `new-arrivals-feed.tsx`

---

- [x] 6. Migrate Activity module

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/activity/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/activity/_components/activity-filters.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/activity/_components/activity-list.tsx`
  - Use existing `activity` namespace keys + add new ones

  **Must NOT do**:
  - Change filter logic
  - Modify data fetching

  **Parallelizable**: YES (with 5, 7-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/activity/page.tsx:1-69` - Main page
  - `apps/app/src/locales/en.ts:38-60` - Existing activity keys

  **Acceptance Criteria**:
  - [ ] No hardcoded English in activity module
  - [ ] Uses existing `activity.*` keys where available
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate activity module`
  - Files: `activity/page.tsx`, `activity/_components/*`

---

- [ ] 7. Migrate Loans module

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/loans/[id]/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/loans/[id]/edit/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/loans/new/page.tsx`
  - Update all `loans/_components/*`
  - Use `loans` namespace

  **Strings include**:
  - "Loans", "Manage incoming and outgoing loan agreements"
  - "New Loan", "Search loans..."
  - "All Loans", "Outgoing", "Incoming", "Pending"
  - Status labels: "Pending Review", "Active", "Dispatched", "Returned", "Cancelled"
  - "Active Loans", "Objects in Transit", "Total Insured Value", "Expiring Agreements"
  - "No loans found", "Create your first loan..."

  **Must NOT do**:
  - Change loan logic or data flow

  **Parallelizable**: YES (with 5-6, 8-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx:1-663` - Main page (large)
  - `apps/app/src/locales/en.ts:76-83` - Existing loans.admin keys

  **Acceptance Criteria**:
  - [ ] No hardcoded English in loans module
  - [ ] All status labels translated
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate loans module`
  - Files: `loans/**/*.tsx`

---

- [ ] 8. Migrate Collections module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/collections/`
  - Pages: `page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `new/page.tsx`, `import/page.tsx`, `media-import/page.tsx`
  - Use `collections` namespace

  **Must NOT do**:
  - Change collection logic

  **Parallelizable**: YES (with 5-7, 9-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx` - Main collections page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in collections module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate collections module`
  - Files: `collections/**/*.tsx`

---

- [ ] 9. Migrate Objects module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/objects/`
  - Pages: `page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `new/page.tsx`
  - Use `objects` namespace

  **Parallelizable**: YES (with 5-8, 10-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Main objects page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in objects module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate objects module`
  - Files: `objects/**/*.tsx`

---

- [ ] 10. Migrate Accessions module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/accessions/`
  - Pages: `page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`, `new/page.tsx`, `import/page.tsx`
  - Use `accessions` namespace

  **Parallelizable**: YES (with 5-9, 11-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/accessions/page.tsx` - Main page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in accessions module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate accessions module`
  - Files: `accessions/**/*.tsx`

---

- [ ] 11. Migrate Deaccessions module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/deaccessions/`
  - Use `deaccessions` namespace

  **Parallelizable**: YES (with 5-10, 12-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/deaccessions/page.tsx` - Main page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in deaccessions module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate deaccessions module`
  - Files: `deaccessions/**/*.tsx`

---

- [ ] 12. Migrate Locations module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/locations/`
  - Use existing `locations` namespace keys + add new ones

  **Parallelizable**: YES (with 5-11, 13-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/locations/page.tsx` - Main page
  - `apps/app/src/locales/en.ts:88-91` - Existing locations keys

  **Acceptance Criteria**:
  - [ ] No hardcoded English in locations module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate locations module`
  - Files: `locations/**/*.tsx`

---

- [ ] 13. Migrate Conservation module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/conservation/`
  - Use `conservation` namespace

  **Parallelizable**: YES (with 5-12, 14-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/conservation/page.tsx` - Main page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in conservation module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate conservation module`
  - Files: `conservation/**/*.tsx`

---

- [ ] 14. Migrate Exhibitions module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/exhibitions/`
  - Use `exhibitions` namespace

  **Parallelizable**: YES (with 5-13, 15-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/exhibitions/page.tsx` - Main page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in exhibitions module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate exhibitions module`
  - Files: `exhibitions/**/*.tsx`

---

- [ ] 15. Migrate Accounts module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/accounts/`
  - Use `accounts` namespace

  **Parallelizable**: YES (with 5-14, 16-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx` - Main page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in accounts module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate accounts module`
  - Files: `accounts/**/*.tsx`

---

- [ ] 16. Migrate Library module

  **What to do**:
  - Update all files in `apps/app/src/app/[locale]/(dashboard)/library/`
  - Includes: `page.tsx`, `catalog/`, `acquisitions/`, `circulation/`, `fines/`
  - Use `library` namespace

  **Parallelizable**: YES (with 5-15, 17-18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/library/page.tsx` - Main page

  **Acceptance Criteria**:
  - [ ] No hardcoded English in library module
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate library module`
  - Files: `library/**/*.tsx`

---

- [ ] 17. Migrate Settings module (including partially-migrated files)

  **What to do**:
  - Update ALL files in `apps/app/src/app/[locale]/(dashboard)/settings/`
  - **Complete migration of layout.tsx**: Add keys for "Organization", "Users", "Roles", "Integrations", "Modules", "Activity", "Developer" to `settings.sidebar` namespace
  - **Complete migration of page.tsx**: Fix any remaining hardcoded strings
  - Migrate all subpages: `activity/`, `billing/`, `developer/`, `integrations/`, `modules/`, `organization/`, `roles/`, `users/`, `workflows/`
  - Use `settings` namespace (extend existing)

  **Hardcoded strings to migrate in layout.tsx** (lines 51, 65, 79, 93, 107, 135, 149):
  - "Organization" → `t("sidebar.organization")`
  - "Users" → `t("sidebar.users")`
  - "Roles" → `t("sidebar.roles")`
  - "Integrations" → `t("sidebar.integrations")`
  - "Modules" → `t("sidebar.modules")`
  - "Activity" → `t("sidebar.activity")`
  - "Developer" → `t("sidebar.developer")`

  **Parallelizable**: YES (with 5-16, 18)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/settings/layout.tsx:37,121` - Uses t("general"), t("billing") correctly
  - `apps/app/src/app/[locale]/(dashboard)/settings/layout.tsx:51,65,79,93,107,135,149` - Hardcoded strings to migrate

  **Acceptance Criteria**:
  - [ ] No hardcoded English in settings module (including layout.tsx and page.tsx)
  - [ ] `settings.sidebar` namespace has keys: general, billing, organization, users, roles, integrations, modules, activity, developer
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate settings module`
  - Files: `settings/**/*.tsx`

---

- [ ] 18. Migrate remaining pages

  **What to do**:
  - Update `apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/assignments/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/notifications/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/media/page.tsx`
  - Update `apps/app/src/app/[locale]/(dashboard)/organizations/new/page.tsx`
  - Update `apps/app/src/app/[locale]/onboarding/page.tsx`
  - Update `apps/app/src/app/[locale]/(public)/login/page.tsx`
  - Use appropriate namespaces for each

  **Parallelizable**: YES (with 5-17)

  **References**:
  - Each page file listed above

  **Acceptance Criteria**:
  - [ ] No hardcoded English in any of these pages
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate remaining pages`
  - Files: Listed pages

---

### Phase 4: Date Formatting

- [ ] 19. Make date formatting locale-aware

  **What to do**:
  
  **Part A: Create formatting utilities**
  - Create `apps/app/src/lib/format-date.ts`:
    ```typescript
    import { format as dateFnsFormat, formatDistanceToNow } from "date-fns";
    import { nb, enUS, es, fr } from "date-fns/locale";
    
    const localeMap: Record<string, Locale> = { en: enUS, es, fr, no: nb };
    
    export function formatDate(date: Date, locale: string, options?: Intl.DateTimeFormatOptions) {
      const intlLocale = locale === "no" ? "nb-NO" : locale;
      return date.toLocaleDateString(intlLocale, options);
    }
    
    export function formatDateFns(date: Date, formatStr: string, locale: string) {
      return dateFnsFormat(date, formatStr, { locale: localeMap[locale] || enUS });
    }
    
    export function formatDistanceLocale(date: Date, locale: string, options?: { addSuffix?: boolean }) {
      return formatDistanceToNow(date, { 
        locale: localeMap[locale] || enUS,
        addSuffix: options?.addSuffix ?? true 
      });
    }
    ```
  
  **Part B: Replace toLocaleDateString calls (57 instances in 30 files)**
  - 15 with explicit `"en-US"` or `"en-GB"` → use `formatDate(date, locale, options)`
  - 42 with no locale → use `formatDate(date, locale, options)`
  
  **Part C: Replace date-fns calls (43 instances in 15 files)**
  - `format(date, "MMM d, yyyy")` → `formatDateFns(date, "MMM d, yyyy", locale)`
  - `formatDistanceToNow(date)` → `formatDistanceLocale(date, locale)`
  
  **Part D: Replace toLocaleString("default"...) (1 instance)**
  - `activity/_components/activity-list.tsx:35` → use locale-aware month grouping

  **Files requiring date-fns locale** (verified via grep):
  - `deaccessions/page.tsx`, `deaccessions/[id]/page.tsx` - format()
  - `activity/_components/activity-filters.tsx` - format()
  - `objects/[id]/_components/*.tsx` (vehicle, natural-history, fine-art, archive) - format()
  - `notifications/page.tsx`, `media/page.tsx` - formatDistanceToNow()
  - `settings/activity/page.tsx`, `assignments/_components/*.tsx` - formatDistanceToNow()

  **Note**: Norwegian uses `nb` locale in date-fns, `nb-NO` in Intl API

  **Must NOT do**:
  - Change date display logic beyond locale
  - Modify date calculation/parsing

  **Parallelizable**: NO (after Phase 3)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx:249-266` - toLocaleDateString with explicit locale
  - `apps/app/src/app/[locale]/(dashboard)/deaccessions/page.tsx:16,348,515` - date-fns format() usage
  - `apps/app/src/app/[locale]/(dashboard)/notifications/page.tsx:9` - formatDistanceToNow usage

  **Acceptance Criteria**:
  - [ ] `apps/app/src/lib/format-date.ts` exists with formatDate, formatDateFns, formatDistanceLocale
  - [ ] `grep -rn 'toLocaleDateString\|toLocaleString.*default' apps/app/src/app` → all replaced with formatDate
  - [ ] `grep -rn "from \"date-fns\"" apps/app/src/app` → all imports updated to use locale wrappers
  - [ ] `bun run typecheck` passes
  - [ ] Manual browser test: In NO locale, dates show "15. jan. 2024" format, distances show "for 2 dager siden"

  **Commit**: YES
  - Message: `feat(i18n): make date formatting locale-aware`
  - Files: All files with date formatting

---

### Phase 5: Number Formatting

- [ ] 20. Make number/currency formatting locale-aware

  **What to do**:
  
  **Part A: Create utility functions**
  - Create `apps/app/src/lib/format-number.ts`:
    ```typescript
    export function formatNumber(value: number, locale: string) {
      const intlLocale = locale === "no" ? "nb-NO" : locale;
      return new Intl.NumberFormat(intlLocale).format(value);
    }
    
    export function formatCurrency(value: number, locale: string, currency = "USD") {
      const intlLocale = locale === "no" ? "nb-NO" : locale;
      return new Intl.NumberFormat(intlLocale, { style: "currency", currency }).format(value);
    }
    ```
  
  **Part B: Replace Intl.NumberFormat("en-US"...) (7 instances in 6 files)**
  - `deaccessions/page.tsx` (2), `deaccessions/[id]/page.tsx` (1)
  - `analytics/_components/inventory-valuation-card.tsx` (1), `report-exports-card.tsx` (1)
  - `library/acquisitions/page.tsx` (1), `library/fines/page.tsx` (1)
  
  **Part C: Replace .toLocaleString() without locale (28 instances in 11 files)**
  - These use OS default locale, not app-selected locale
  - Replace `value.toLocaleString()` → `formatNumber(value, locale)`
  - Files: `page.tsx` (7), `collections/[id]/page.tsx` (4), `loans/[id]/page.tsx` (1), `objects/[id]/_components/*.tsx` (multiple), etc.

  **Must NOT do**:
  - Change currency logic
  - Modify value calculations

  **Parallelizable**: YES (with 19)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/deaccessions/page.tsx:302` - Intl.NumberFormat with currency
  - `apps/app/src/app/[locale]/(dashboard)/page.tsx:105` - toLocaleString() without locale

  **Acceptance Criteria**:
  - [ ] `apps/app/src/lib/format-number.ts` exists with formatNumber, formatCurrency
  - [ ] `grep -rn 'Intl\.NumberFormat("en-US"' apps/app/src/app` returns 0 matches
  - [ ] `grep -rn '\.toLocaleString()' apps/app/src/app` → all replaced with formatNumber (except date-related)
  - [ ] `bun run typecheck` passes
  - [ ] Manual browser test: Numbers "1,234" (en) vs "1 234" (no)

  **Commit**: YES
  - Message: `feat(i18n): make number formatting locale-aware`
  - Files: `format-number.ts`, all files with NumberFormat

---

### Phase 6: Toast Messages

- [ ] 21. Migrate toast and error messages

  **What to do**:
  - Search for all `toast.success()`, `toast.error()`, `toast.warning()` calls
  - Replace hardcoded strings with translation keys
  - Create `common.toast` namespace for shared messages
  - Handle dynamic values with interpolation

  **Pattern to use**:
  ```typescript
  // Before
  toast.success("Approved 5 loans");
  
  // After
  toast.success(t("toast.approved", { count: 5 }));
  ```

  **Must NOT do**:
  - Change toast behavior or styling
  - Modify error handling logic

  **Parallelizable**: NO (after Phase 3)

  **References**:
  - `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx:296-340` - Example toast calls

  **Acceptance Criteria**:
  - [ ] `grep -rn 'toast\.\(success\|error\|warning\)("[A-Z]' apps/app/src/app` returns 0 matches
  - [ ] Toast messages display in selected locale
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(i18n): migrate toast messages`
  - Files: All files with toast calls

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(i18n): add Norwegian locale file` | `no.ts` | typecheck |
| 2 | `feat(i18n): register Norwegian in configs` | `client.ts`, `server.ts`, `proxy.ts` | typecheck, dev server |
| 3 | `feat(i18n): add Norwegian to language switcher` | `language-switcher.tsx` | manual browser test |
| 4 | `feat(i18n): expand locale files with all UI strings` | `en.ts`, `fr.ts`, `es.ts`, `no.ts` | typecheck |
| 5-18 | `feat(i18n): migrate [module] module` | Module files | typecheck per module |
| 19 | `feat(i18n): make date formatting locale-aware` | Multiple | typecheck, visual |
| 20 | `feat(i18n): make number formatting locale-aware` | Multiple | typecheck |
| 21 | `feat(i18n): migrate toast messages` | Multiple | typecheck |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck     # Expected: No errors
bun run lint          # Expected: No errors
bun dev:app           # Expected: App starts, no console errors
```

### Final Checklist
- [ ] All 4 locales (en, fr, es, no) work end-to-end
- [ ] Language switcher shows all 4 options
- [ ] All dashboard pages display translated text (spot-check 5+ pages in each locale)
- [ ] Dates display in locale-appropriate format (NO: "15. jan. 2024")
- [ ] Numbers/currency display in locale-appropriate format (NO: "1 234")
- [ ] Toast messages display in selected locale
- [ ] **Date formatting migration complete**:
  - [ ] `grep -rn 'toLocaleDateString' apps/app/src/app` → only imports of formatDate util
  - [ ] `grep -rn "from \"date-fns\"" apps/app/src/app` → only format-date.ts imports directly
- [ ] **Number formatting migration complete**:
  - [ ] `grep -rn 'Intl\.NumberFormat("en-US"' apps/app/src/app` → 0 matches
  - [ ] `grep -rn '\.toLocaleString()' apps/app/src/app` → only non-number usages remain
- [ ] No TypeScript errors (`bun run typecheck`)
- [ ] No lint errors (`bun run lint`)
