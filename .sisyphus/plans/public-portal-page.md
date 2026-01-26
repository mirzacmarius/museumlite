# Public Portal Admin Settings Page

## Context

### Original Request
Implement the Public Portal page from the HTML mockup (`museumlite.aura.build.html` lines 3625-3720). This is an admin settings page that allows organization administrators to configure their public-facing collection portal.

### Interview Summary
**Key Discussions**:
- **Settings Scope**: Organization-level only (no per-collection overrides)
- **Preview Type**: Real preview using iframe to actual public portal at `apps/web/collections/[slug]/`
- **Public Pages**: Keep existing implementation in `apps/web` - NO new public pages needed
- **Feature Access**: Require Pro tier (use existing `public_portal` feature gate)

**Research Findings**:
- Public portal pages already exist in `apps/web/src/app/collections/[slug]/` (294 lines browser, 348 lines item detail)
- Backend infrastructure exists: `listPublic`, `getPublic`, `getPublicFilters` queries
- Schema fields on collections: `isPubliclyVisible`, `isSearchable`, `isValuationVisible`, `publicSlug`, `isHighResDownloadable`
- Current portal page at `apps/app/src/app/[locale]/(dashboard)/portal/page.tsx` is a "Coming Soon" placeholder (82 lines)

### Metis Review
**Identified Gaps** (addressed):
- Need organization-level portal settings (not just collection-level)
- Preview needs to show actual portal, not static mockup
- Settings form needs Pro tier feature gate

---

## Work Objectives

### Core Objective
Build an admin settings page that allows Pro-tier organizations to configure their public portal, with live preview via iframe to the actual public portal.

### Concrete Deliverables
1. Schema update: Add `portalSettings` object to `organizations.settings`
2. Backend: `updatePortalSettings` mutation + `getPortalSettings` query
3. Frontend: Replace placeholder portal page with settings sidebar + iframe preview

### Definition of Done
- [x] Portal settings save and persist across page reloads
- [x] Iframe preview shows actual public portal at `{WEB_URL}/collections/{orgSlug}`
- [x] Settings only editable by Pro tier organizations
- [x] TypeScript compiles without errors: `bun run typecheck`
- [x] Lint passes: `bun run lint`

### Must Have
- Portal Enabled toggle (master on/off)
- Public Search toggle
- High-Res Downloads toggle
- Show Valuations toggle
- Real-time iframe preview of public portal
- Pro tier feature gate

### Must NOT Have (Guardrails)
- NO new public portal pages (use existing `apps/web/collections/[slug]/`)
- NO per-collection portal overrides (organization-level only)
- NO custom theming/branding for public portal
- NO analytics/visitor tracking
- NO mobile responsive redesign
- NO SEO metadata optimization

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest in packages/backend)
- **User wants tests**: Manual verification (no TDD requested)
- **Framework**: vitest (existing)

### Manual QA Approach

Each TODO includes detailed manual verification:
- **Frontend changes**: Browser verification at `http://localhost:3000/portal`
- **Backend changes**: Convex dashboard + frontend integration
- **TypeScript**: `bun run typecheck` passes
- **Lint**: `bun run lint` passes

---

## Task Flow

```
Task 1 (Schema) → Task 2 (Mutation) → Task 3 (Query)
                                          ↓
Task 4 (Sidebar Component) ← ← ← ← ← ← ← ↓
         ↓
Task 5 (Preview Component)
         ↓
Task 6 (Assemble Page)
         ↓
Task 7 (Update Public Queries) [OPTIONAL - if needed]
         ↓
Task 8 (Final Verification)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 4, 5 | Independent components after backend is ready |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Mutation needs schema types |
| 3 | 1 | Query needs schema types |
| 4 | 2, 3 | Sidebar uses mutation and query |
| 5 | 3 | Preview needs org settings to determine URL |
| 6 | 4, 5 | Page assembles both components |
| 7 | 1 | Public queries may need to respect org settings |
| 8 | 6 | Final verification after all components |

---

## TODOs

- [x] 1. Add portal settings to organization schema

  **What to do**:
  - Add `portalSettings` object to `organizations.settings` in `schema.ts`
  - Fields: `isEnabled`, `isSearchEnabled`, `isHighResEnabled`, `isValuationVisible` (all optional booleans)
  - Run `bunx convex dev` to push schema changes

  **Must NOT do**:
  - Do NOT add custom slug field (use existing org slug)
  - Do NOT modify collection-level fields

  **Parallelizable**: NO (first task, others depend on it)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/schema.ts:117-169` - Organizations table with settings object pattern
  - `packages/backend/convex/schema.ts:126-164` - Existing settings object structure to extend

  **Acceptance Criteria**:
  
  **TypeScript Verification**:
  - [ ] `bun run typecheck` passes in packages/backend
  - [ ] Convex generates types without errors

  **Manual Verification**:
  - [ ] Run `bunx convex dev` in packages/backend - schema pushes successfully
  - [ ] Check Convex dashboard - organizations table schema shows new portalSettings fields

  **Commit**: YES
  - Message: `feat(schema): add portal settings to organizations`
  - Files: `packages/backend/convex/schema.ts`

---

- [x] 2. Create `updatePortalSettings` mutation

  **What to do**:
  - Add mutation to `packages/backend/convex/organizations.ts`
  - Args: `organizationId`, `portalSettings` object (all fields optional)
  - Require `organization.manage_settings` permission
  - Require Pro tier using `requireFeatureAccess(ctx, organizationId, "public_portal")`
  - Merge with existing org settings using spread operator pattern
  - Add audit log entry

  **Must NOT do**:
  - Do NOT bypass permission check
  - Do NOT allow free tier to update portal settings

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/organizations.ts:374-460` - `update` mutation pattern for settings
  - `packages/backend/convex/organizations.ts:402-412` - Permission check pattern
  - `packages/backend/convex/organizations.ts:436-441` - Settings merge pattern

  **API/Type References**:
  - `packages/backend/convex/utils/permissions.ts` - `requirePermission` function
  - `packages/backend/convex/utils/featureGates.ts` - `requireFeatureAccess` function

  **Acceptance Criteria**:
  
  **TypeScript Verification**:
  - [ ] `bun run typecheck` passes
  - [ ] Return type is `v.null()`

  **Manual Verification**:
  - [ ] Test via Convex dashboard "Run Function":
    - Call `organizations.updatePortalSettings` with valid args
    - Verify settings are saved to organization document
  - [ ] Verify permission check:
    - Call without admin permission → should throw error
  - [ ] Verify feature gate:
    - Call with free tier org → should throw "Feature not available" error

  **Commit**: YES
  - Message: `feat(backend): add updatePortalSettings mutation`
  - Files: `packages/backend/convex/organizations.ts`

---

- [x] 3. Create `getPortalSettings` query

  **What to do**:
  - Add query to `packages/backend/convex/organizations.ts`
  - Args: `organizationId`
  - Returns: `portalSettings` object or default values
  - No permission check needed (settings are org-internal)
  - Default all boolean fields to `false` if not set

  **Must NOT do**:
  - Do NOT require authentication (query is read-only)
  - Do NOT expose sensitive organization data

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/organizations.ts:465-491` - `getSettings` query pattern
  - `packages/backend/convex/organizations.ts:273-317` - `get` query return type pattern

  **Acceptance Criteria**:
  
  **TypeScript Verification**:
  - [ ] `bun run typecheck` passes
  - [ ] Return type includes all portal settings fields

  **Manual Verification**:
  - [ ] Test via Convex dashboard "Run Function":
    - Call `organizations.getPortalSettings` with valid orgId
    - Verify returns correct shape: `{ isEnabled, isSearchEnabled, isHighResEnabled, isValuationVisible }`
  - [ ] Test with org that has no portal settings → returns default values (all false)

  **Commit**: YES
  - Message: `feat(backend): add getPortalSettings query`
  - Files: `packages/backend/convex/organizations.ts`

---

- [x] 4. Build PortalSettingsSidebar component

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/portal/_components/portal-settings-sidebar.tsx`
  - Width: `w-80` (matches mockup)
  - Include:
    - Portal URL display (read-only, shows `{WEB_URL}/collections/{orgSlug}`)
    - Portal Enabled toggle (Switch)
    - Public Search toggle (Switch)
    - High-Res Downloads toggle (Switch)
    - Show Valuations toggle (Switch)
    - Save button
  - Use `useMutation(api.organizations.updatePortalSettings)`
  - Use `useQuery(api.organizations.getPortalSettings)` for initial values
  - Show loading state while query is pending
  - Show success toast on save
  - Disable form controls for non-Pro tier orgs (use PermissionGate or feature check)

  **Must NOT do**:
  - Do NOT add custom slug input (use existing org slug)
  - Do NOT add complex validation (simple boolean toggles)

  **Parallelizable**: YES (with Task 5, after Tasks 2-3 complete)

  **References**:
  
  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:338-398` - Settings form card pattern
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:476-495` - Switch toggle pattern
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:660-668` - Save button pattern

  **API/Type References**:
  - `packages/ui/src/components/switch.tsx` - Switch component
  - `packages/ui/src/components/button.tsx` - Button component
  - `packages/ui/src/components/label.tsx` - Label component

  **UI References**:
  - `museumlite.aura.build.html:3625-3720` - Mockup design for layout

  **Acceptance Criteria**:
  
  **TypeScript Verification**:
  - [ ] `bun run typecheck` passes
  - [ ] Component props are properly typed

  **Manual Verification**:
  - [ ] Navigate to `http://localhost:3000/portal`
  - [ ] Verify sidebar appears on left with w-80 width
  - [ ] Verify all 4 toggles render with labels
  - [ ] Toggle a setting → Click Save → Refresh page → Setting persists
  - [ ] Verify URL display shows correct format

  **Commit**: YES
  - Message: `feat(portal): add PortalSettingsSidebar component`
  - Files: `apps/app/src/app/[locale]/(dashboard)/portal/_components/portal-settings-sidebar.tsx`

---

- [x] 5. Build PortalPreview component

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/portal/_components/portal-preview.tsx`
  - Browser mockup chrome (dots + URL bar) matching mockup design
  - Iframe pointing to `{NEXT_PUBLIC_WEB_URL}/collections/{orgSlug}`
  - Get `NEXT_PUBLIC_WEB_URL` from environment (or fallback to relative URL)
  - Get `orgSlug` from `useOrganization()` hook
  - Show "Enable portal to preview" message when portal is disabled
  - Rounded corners, proper border styling (`border-white/10`)

  **Must NOT do**:
  - Do NOT add mobile/tablet preview toggle (not in scope)
  - Do NOT add screenshot functionality

  **Parallelizable**: YES (with Task 4, after Task 3 complete)

  **References**:
  
  **Pattern References**:
  - `museumlite.aura.build.html:3680-3715` - Browser mockup chrome styling

  **Component References**:
  - `apps/app/src/components/organization-provider.tsx` - `useOrganization()` hook for getting org slug

  **External References**:
  - Mockup shows browser chrome with 3 dots (red/yellow/green) and URL bar

  **Acceptance Criteria**:
  
  **TypeScript Verification**:
  - [ ] `bun run typecheck` passes

  **Manual Verification**:
  - [ ] Navigate to `http://localhost:3000/portal`
  - [ ] Verify browser mockup chrome renders (3 dots, URL bar)
  - [ ] Verify iframe loads public portal content
  - [ ] If portal disabled → Shows "Enable portal to preview" message
  - [ ] If portal enabled → Iframe shows actual public collection page

  **Commit**: YES
  - Message: `feat(portal): add PortalPreview component with browser mockup`
  - Files: `apps/app/src/app/[locale]/(dashboard)/portal/_components/portal-preview.tsx`

---

- [x] 6. Assemble portal page replacing placeholder

  **What to do**:
  - Replace content in `apps/app/src/app/[locale]/(dashboard)/portal/page.tsx`
  - Layout: flex row with sidebar (w-80) and main preview area (flex-1)
  - Import and use PortalSettingsSidebar and PortalPreview components
  - Keep existing header ("Public Portal") and description
  - Keep existing loading and no-organization states
  - Add PermissionGate for `organization.manage` around settings
  - Add feature gate check for Pro tier (show upgrade prompt for free tier)

  **Must NOT do**:
  - Do NOT remove loading/error states
  - Do NOT change the route path

  **Parallelizable**: NO (depends on Tasks 4-5)

  **References**:
  
  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/portal/page.tsx:1-82` - Current placeholder to replace
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:252-277` - Loading state pattern

  **Component References**:
  - `apps/app/src/components/permission-gate.tsx` - PermissionGate component

  **UI Layout**:
  ```
  ┌─────────────────────────────────────────────────────────┐
  │ Public Portal (header)                                  │
  ├──────────────┬──────────────────────────────────────────┤
  │ Sidebar      │    Browser Mockup Preview                │
  │ (w-80)       │    (flex-1)                              │
  │              │    ┌─────────────────────────────┐      │
  │ Settings     │    │ ● ● ●  Browser Chrome       │      │
  │ Form         │    ├─────────────────────────────┤      │
  │              │    │                             │      │
  │              │    │   (iframe)                  │      │
  │              │    │                             │      │
  │              │    └─────────────────────────────┘      │
  └──────────────┴──────────────────────────────────────────┘
  ```

  **Acceptance Criteria**:
  
  **TypeScript Verification**:
  - [ ] `bun run typecheck` passes

  **Manual Verification**:
  - [ ] Navigate to `http://localhost:3000/portal`
  - [ ] Verify layout matches mockup (sidebar left, preview right)
  - [ ] Verify "Coming Soon" message is GONE
  - [ ] Verify settings and preview are functional together
  - [ ] Toggle "Portal Enabled" → Observe preview updates (shows/hides content)

  **Commit**: YES
  - Message: `feat(portal): implement admin settings page with live preview`
  - Files: `apps/app/src/app/[locale]/(dashboard)/portal/page.tsx`

---

- [x] 7. Update public queries to respect org-level portal settings (CONDITIONAL)

  **What to do**:
  - **ONLY IF NEEDED**: Check if existing public queries already check `isPubliclyVisible`
  - If public queries ignore org-level settings, update them to:
    - Check `org.settings.portalSettings.isEnabled` before returning data
    - Respect `isSearchEnabled` for search functionality
    - Respect `isValuationVisible` for valuation data
  - This task may be SKIPPED if existing queries already handle this correctly

  **Must NOT do**:
  - Do NOT break existing public portal functionality
  - Do NOT add breaking changes to query return types

  **Parallelizable**: NO (depends on Task 1, independent of frontend)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/collections.ts` - Look for `listPublic`, `getPublic`, `getPublicFilters`

  **Assessment Required**:
  - [ ] First, READ the public queries to assess if changes are needed
  - [ ] If queries already check settings appropriately → SKIP this task
  - [ ] If changes needed → Implement and test

  **Acceptance Criteria**:
  
  **Assessment**:
  - [ ] Document whether changes were needed (YES/NO)
  - [ ] If YES: TypeScript compiles, queries work correctly
  - [ ] If NO: Document why task was skipped

  **Commit**: CONDITIONAL
  - Message: `feat(backend): respect org portal settings in public queries`
  - Files: `packages/backend/convex/collections.ts` (if changed)

---

- [x] 8. Final verification

  **What to do**:
  - Run full verification suite
  - Test complete user flow end-to-end
  - Verify no regressions

  **Parallelizable**: NO (final task)

  **References**: All previous tasks

  **Acceptance Criteria**:
  
  **Build Verification**:
  - [ ] `bun run typecheck` → Passes (exit code 0)
  - [ ] `bun run lint` → Passes (no errors)

  **End-to-End Flow**:
  - [ ] Login as admin of Pro tier organization
  - [ ] Navigate to `/portal`
  - [ ] Toggle "Portal Enabled" ON
  - [ ] Click Save
  - [ ] Verify preview iframe loads public portal
  - [ ] Toggle "Show Valuations" ON
  - [ ] Click Save
  - [ ] Refresh page → Settings persist
  - [ ] In a new incognito window, visit public portal URL
  - [ ] Verify public portal displays correctly

  **Regression Check**:
  - [ ] Visit `/settings/organization` → Still works
  - [ ] Visit existing public portal → Still works
  - [ ] No TypeScript errors in console

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(schema): add portal settings to organizations` | schema.ts | convex dev |
| 2 | `feat(backend): add updatePortalSettings mutation` | organizations.ts | typecheck |
| 3 | `feat(backend): add getPortalSettings query` | organizations.ts | typecheck |
| 4 | `feat(portal): add PortalSettingsSidebar component` | _components/portal-settings-sidebar.tsx | typecheck |
| 5 | `feat(portal): add PortalPreview component with browser mockup` | _components/portal-preview.tsx | typecheck |
| 6 | `feat(portal): implement admin settings page with live preview` | portal/page.tsx | typecheck + lint |
| 7 (conditional) | `feat(backend): respect org portal settings in public queries` | collections.ts | typecheck |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: Success (exit code 0)
bun run lint       # Expected: No errors
```

### Final Checklist
- [x] All "Must Have" features present
- [x] All "Must NOT Have" items absent
- [x] TypeScript compiles without errors
- [x] Lint passes without errors
- [x] Portal settings save and persist
- [x] Preview iframe shows real public portal
- [x] Feature gated to Pro tier
