# Sidebar Plan Information Section

## Context

### Original Request
Implement the "Plan Usage Stats" section from the sidebar design in `aura-html-pages/loans-overview-admin.html` (lines 148-192). This section displays the organization's subscription tier and usage metrics with visual progress bars.

### Interview Summary
**Key Discussions**:
- Location: Between SidebarContent and SidebarFooter in app-sidebar.tsx
- Visual design: Plan badge (gradient dot + tier name), 3 progress bars, upgrade button
- Data source: New Convex query to aggregate usage stats

**Research Findings**:
- Sidebar component: `apps/app/src/components/app-sidebar.tsx` (650 lines)
- Progress component: `packages/ui/src/components/progress.tsx` (exists and usable)
- Tier limits: `packages/backend/convex/utils/featureGates.ts` (TIER_LIMITS constant)
- Organization data pattern: Uses `useQuery` with skip pattern for org-dependent queries

### Metis Review
**Identified Gaps** (addressed):
- Exports vs Uploads: Using "exports" (what's tracked in codebase) but labeling as "Monthly Exports"
- Enterprise unlimited: Display "Unlimited" text when limit is null
- Colors: Using static colors per metric (matching HTML design)
- Collapsed state: Hide section when sidebar is in icon mode

---

## Work Objectives

### Core Objective
Add a "Plan Usage Stats" section to the sidebar that displays the organization's subscription tier and real-time usage metrics (storage, object count, monthly exports) with visual progress indicators.

### Concrete Deliverables
- New Convex query: `api.organizations.getUsageStats`
- New React component: `PlanUsageStats` embedded in app-sidebar.tsx
- Visual matching HTML reference design with Tailwind styling

### Definition of Done
- [x] Plan badge displays current tier (Free/Pro/Enterprise)
- [x] Storage usage shows current/limit with progress bar
- [x] Object count shows current/limit with progress bar
- [x] Monthly exports shows current/limit with progress bar
- [x] Upgrade button navigates to settings/billing
- [x] Section hidden when sidebar collapsed
- [x] No TypeScript errors: `bun run typecheck`
- [x] No lint errors: `bun run lint`

### Must Have
- Real-time updates when usage changes (Convex reactivity)
- Accessible progress bars with ARIA attributes
- Proper handling of enterprise tier (unlimited = no progress bar, show "Unlimited")
- Graceful handling when organization is not selected

### Must NOT Have (Guardrails)
- MUST NOT add a 4th metric for users (not in design)
- MUST NOT add checkout/payment flow (upgrade button links to existing billing page)
- MUST NOT add alert/notification system for approaching limits
- MUST NOT add usage history or trend graphs
- MUST NOT create a separate file for < 60 lines of component code
- MUST NOT use preloaded query (org ID comes from context, not layout params)
- MUST NOT modify SidebarFooter structure

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest in packages/backend/)
- **User wants tests**: Tests-after (verify query logic, not UI component)
- **Framework**: vitest with convex-test

### Manual Verification
Each task includes specific browser/terminal verification steps.

---

## Task Flow

```
Task 1 (Convex Query) → Task 2 (UI Component) → Task 3 (Integration)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 1 | None | Backend query is independent |
| 2 | 1 | Needs query return type for TypeScript |
| 3 | 2 | Integration requires component |

---

## TODOs

- [x] 1. Create Convex query for organization usage stats

  **What to do**:
  - Create new query `getUsageStats` in `packages/backend/convex/organizations.ts`
  - Query must:
    - Accept `organizationId` argument (required)
    - Count documents in `collections` table for org
    - Sum `fileSize` from `mediaFiles` table for org
    - Get current month export count from `exportUsage` table
    - Get tier limits from `getTierLimits()`
    - Return structured object with usage + limits

  **Must NOT do**:
  - Do NOT add a mutation - this is read-only
  - Do NOT add user count metric
  - Do NOT add caching - Convex handles reactivity

  **Parallelizable**: NO (first task)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `packages/backend/convex/utils/featureGates.ts:158-174` - `enforceObjectQuota()` shows how to count collections
  - `packages/backend/convex/utils/featureGates.ts:176-197` - `enforceMediaQuota()` shows how to sum mediaFiles size
  - `packages/backend/convex/utils/featureGates.ts:222-241` - `enforceExportQuota()` shows exportUsage query pattern
  - `packages/backend/convex/utils/featureGates.ts:268-270` - `getTierLimits()` helper to get limits for tier

  **API/Type References** (contracts to implement against):
  - `packages/backend/convex/utils/featureGates.ts:25-30` - `TierLimits` type definition
  - `packages/backend/convex/utils/featureGates.ts:4` - `SubscriptionTier` type
  - `packages/backend/convex/schema.ts` - `collections`, `mediaFiles`, `exportUsage` table schemas

  **WHY Each Reference Matters**:
  - `enforceObjectQuota`: Shows exact index pattern for counting org's collections
  - `enforceMediaQuota`: Shows exact pattern for summing fileSize with reduce
  - `enforceExportQuota`: Shows exact pattern for getting current month's exportUsage
  - `getTierLimits`: Reuse this helper instead of duplicating TIER_LIMITS lookup

  **Acceptance Criteria**:

  **Type validation:**
  - [ ] Query has `args` validator with `organizationId: v.id("organizations")`
  - [ ] Query has `returns` validator specifying exact return shape
  - [ ] No TypeScript errors: run `bun run typecheck` from repo root

  **Manual Execution Verification:**
  - [ ] Using interactive_bash (convex dashboard or CLI):
    - Command: `bunx convex run organizations:getUsageStats --args '{"organizationId": "[valid-org-id]"}'`
    - Expected output contains: `tier`, `storage.used`, `storage.limit`, `objects.used`, `objects.limit`, `exports.used`, `exports.limit`

  **Commit**: YES
  - Message: `feat(backend): add getUsageStats query for organization usage metrics`
  - Files: `packages/backend/convex/organizations.ts`
  - Pre-commit: `bun run typecheck && bun run lint`

---

- [x] 2. Create PlanUsageStats component in sidebar

  **What to do**:
  - Add `PlanUsageStats` component inside `app-sidebar.tsx` (before the default export)
  - Component accepts `organizationId: Id<"organizations"> | undefined`
  - Uses `useQuery` with skip pattern when no org selected
  - Renders:
    - Plan badge: gradient dot + tier name + "Upgrade" button (links to `/settings`)
    - Storage progress bar (indigo color)
    - Object Records progress bar (amber color)
    - Monthly Exports progress bar (emerald color)
  - Handle loading state with skeleton
  - Handle enterprise tier (show "Unlimited" instead of progress bar)
  - Hide entire component when sidebar collapsed

  **Must NOT do**:
  - Do NOT create a separate file - embed in app-sidebar.tsx
  - Do NOT add threshold-based color changes - use static colors per metric
  - Do NOT add tooltip or popover explanations
  - Do NOT add animation beyond existing Progress component transitions

  **Parallelizable**: NO (depends on Task 1)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `apps/app/src/components/app-sidebar.tsx:237-242` - `useQuery` with skip pattern for org-dependent data
  - `apps/app/src/components/app-sidebar.tsx:551-645` - SidebarFooter structure and styling
  - `apps/app/src/components/app-sidebar.tsx:393-410` - Search box styling (for consistent padding/borders)
  - `aura-html-pages/loans-overview-admin.html:148-192` - Visual design reference

  **API/Type References** (contracts to implement against):
  - `packages/ui/src/components/progress.tsx:6-9` - Progress component props interface
  - `packages/backend/convex/_generated/dataModel.ts` - `Id<"organizations">` type

  **External References** (libraries and frameworks):
  - lucide-react: Use existing icons imported at top of file

  **WHY Each Reference Matters**:
  - `collectionGroups` query pattern: Exact pattern for skip-based org queries
  - SidebarFooter: Shows correct styling (bg-zinc-950, border-t border-zinc-800/60, p-3/p-4)
  - HTML reference: Visual spec for layout, colors, typography

  **Styling requirements** (from HTML reference):
  ```
  Container: px-4 py-3 bg-zinc-950 border-t border-zinc-800/60
  Plan badge: w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500
  Plan name: text-xs font-semibold text-zinc-200
  Upgrade button: text-[9px] text-zinc-500 hover:text-indigo-400 uppercase tracking-wide font-medium
  Metric label: text-[10px] text-zinc-500 font-medium
  Metric value: text-[10px] text-zinc-400 font-mono
  Progress bar container: w-full bg-zinc-900 rounded-full h-1 overflow-hidden
  Storage progress: bg-indigo-500
  Objects progress: bg-amber-500/80
  Exports progress: bg-emerald-500/80
  Hide on collapse: group-data-[collapsible=icon]:hidden
  ```

  **Acceptance Criteria**:

  **Type validation:**
  - [ ] No TypeScript errors in app-sidebar.tsx
  - [ ] Run `bun run typecheck` from repo root - passes

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/` (logged in)
    - Verify: Plan badge visible with tier name
    - Verify: 3 progress bars visible with labels
    - Verify: Upgrade button visible (unless enterprise)
    - Action: Collapse sidebar (click collapse button)
    - Verify: Plan stats section is hidden
    - Screenshot: Save evidence to `.sisyphus/evidence/task-2-plan-stats.png`

  **Commit**: YES
  - Message: `feat(app): add PlanUsageStats component to sidebar`
  - Files: `apps/app/src/components/app-sidebar.tsx`
  - Pre-commit: `bun run typecheck && bun run lint`

---

- [x] 3. Wire up component in sidebar and verify end-to-end

  **What to do**:
  - Import and render `PlanUsageStats` in the `AppSidebar` component
  - Place between `</SidebarContent>` and `<SidebarFooter>` (around line 549)
  - Pass `currentOrganizationId` as prop
  - Verify full integration works end-to-end

  **Must NOT do**:
  - Do NOT add preloaded query to layout.tsx
  - Do NOT modify the SidebarFooter structure
  - Do NOT add any additional features beyond the spec

  **Parallelizable**: NO (depends on Task 2)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `apps/app/src/components/app-sidebar.tsx:549` - Location marker: end of SidebarContent
  - `apps/app/src/components/app-sidebar.tsx:207` - How `currentOrganizationId` is obtained from context

  **WHY Each Reference Matters**:
  - Line 549: Exact insertion point for the new component
  - Line 207: Shows how org ID is already available in AppSidebar

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Using playwright browser automation:
    - Navigate to: `http://localhost:3000/` (logged in to org with some objects)
    - Verify: Plan stats section appears between nav and user profile
    - Action: Upload a media file
    - Verify: Storage metric updates in real-time (Convex reactivity)
    - Action: Create a new object
    - Verify: Object count metric updates
    - Action: Switch organization (if multiple exist)
    - Verify: Stats update to reflect new org's usage
    - Screenshot: Save evidence to `.sisyphus/evidence/task-3-integration.png`

  **Lint/Type check:**
  - [ ] `bun run typecheck` - passes
  - [ ] `bun run lint` - passes

  **Commit**: YES
  - Message: `feat(app): integrate PlanUsageStats in sidebar`
  - Files: `apps/app/src/components/app-sidebar.tsx`
  - Pre-commit: `bun run typecheck && bun run lint`

---

- [x] 4. Add unit test for usage stats query

  **What to do**:
  - Create test file `packages/backend/convex/organizations.test.ts` if not exists
  - Add test case for `getUsageStats` query:
    - Test returns correct structure
    - Test counts objects correctly
    - Test sums storage correctly
    - Test handles enterprise (null limits) correctly

  **Must NOT do**:
  - Do NOT test UI component (that's manual verification)
  - Do NOT mock Convex internals - use convex-test

  **Parallelizable**: YES (can be done after Task 1)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `packages/backend/convex/loans.test.ts` - Example test file structure using convex-test
  - `packages/backend/convex/AGENTS.md` - Testing pattern documentation

  **WHY Each Reference Matters**:
  - `loans.test.ts`: Shows exact pattern for convex-test setup with schema

  **Acceptance Criteria**:

  **Test execution:**
  - [x] Command: `bun test organizations.test.ts` from packages/backend/
  - [x] Expected: All tests pass

  **Commit**: YES
  - Message: `test(backend): add tests for getUsageStats query`
  - Files: `packages/backend/convex/organizations.test.ts`
  - Pre-commit: `bun test:once`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(backend): add getUsageStats query for organization usage metrics` | organizations.ts | typecheck + lint |
| 2 | `feat(app): add PlanUsageStats component to sidebar` | app-sidebar.tsx | typecheck + lint |
| 3 | `feat(app): integrate PlanUsageStats in sidebar` | app-sidebar.tsx | typecheck + lint |
| 4 | `test(backend): add tests for getUsageStats query` | organizations.test.ts | bun test |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: no errors
bun run lint       # Expected: no errors
bun test:once      # Expected: all tests pass (from packages/backend/)
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] Plan stats visible in sidebar (not collapsed)
- [x] Plan stats hidden when sidebar collapsed
- [x] Real-time updates work when usage changes (Convex reactivity)
- [x] Enterprise tier shows "Unlimited" correctly
- [x] No TypeScript or lint errors
