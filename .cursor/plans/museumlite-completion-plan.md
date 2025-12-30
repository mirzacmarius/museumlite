# MuseumLite Completion & Polish Plan

**Generated:** 2025-12-30
**Project:** Museum/Library Collection Management SaaS
**Stack:** Turborepo, Next.js 16 App Router, Convex, Bun, Biome, Tailwind v4, shadcn/ui

---

## Executive Summary

MuseumLite is a mature, feature-rich collection management platform with strong foundations. The core museum functionality (Collections, Objects, Loans, Accessions, Locations) is 80-90% complete. The Library integration module is functional but less polished. The codebase follows consistent patterns but has gaps in form validation standardization, i18n coverage, and test infrastructure.

**Key Findings:**
- **52 dashboard pages** implemented across all major modules
- **1391-line schema** with 50+ tables and comprehensive indexes
- **Library module** exists but stats are placeholders, some features incomplete
- **i18n coverage** is minimal (only covers settings/activity in 3 locales)
- **Testing** is stubbed but minimal actual tests exist
- **Design reference** (museumlite.aura.build) could not be fetched - appears to be a client-rendered SPA

---

## Part 1: Current State Audit

### 1.1 Feature Implementation Status

| Domain | Status | Details |
|--------|--------|---------|
| **Auth + Onboarding** | Complete | Google OAuth, username onboarding, user profile |
| **Organizations** | Complete | Multi-tenant, org switcher, create org flow |
| **Roles/Permissions** | Complete | RBAC with system roles, permission gates |
| **Dashboard** | Complete | Analytics, quick actions, recent activity |
| **Collections (Groups)** | Complete | List, detail, create, edit, delete |
| **Objects** | Complete | Full CRUD, filters, media upload, deaccession |
| **Locations** | Complete | Hierarchical tree, object movement |
| **Loans** | Complete | Full workflow (pending→approved→dispatched→returned) |
| **Accessions** | Complete | Workflow with approval |
| **Deaccessions** | Complete | Workflow with approval |
| **Accounts (CRM)** | Complete | Lenders/borrowers management |
| **Library Dashboard** | Partial | Stats are hardcoded placeholders (0) |
| **Library Catalog** | Complete | List, detail, create, edit, ISBN lookup |
| **Library Patrons** | Complete | Full CRUD with edit page |
| **Library Circulation** | Complete | Checkout/checkin/renew workflows |
| **Library Fines** | Partial | Backend exists, UI basic |
| **Library Acquisitions** | Partial | Backend exists, UI basic |
| **Settings/Users** | Complete | User management, role assignment |
| **Settings/Roles** | Complete | Role management |
| **Settings/Billing** | Complete | Polar.sh integration |
| **Settings/Integrations** | Complete | Toggle library integration |
| **Activity Log** | Complete | Global activity feed |
| **Exhibitions** | Partial | Backend exists, no dedicated UI (only object-level) |
| **Conservation** | Partial | Backend exists, no dedicated UI |
| **Import/Export** | Missing | Schema exists (importJobs), no UI |
| **Workflow Config** | Missing | Schema exists (workflowConfigs), no UI |

### 1.2 Frontend Architecture Observations

**Patterns in Use:**
- RSC layout with client-side data fetching via `useQuery`/`useMutation`
- Organization context via `organization-provider.tsx`
- Permission-based rendering via `PermissionGate` component
- Cursor-based pagination with local filter state
- Manual form state management with `useState`

**Technical Debt:**
| Issue | Severity | Fix Effort |
|-------|----------|------------|
| Inconsistent form validation (manual vs React Hook Form/Zod) | Medium | M |
| Filters not URL-persisted (should use nuqs) | Low | S-M |
| Loading states are text-only ("Loading...") | Low | S |
| No skeleton loading components used | Low | S |
| Empty states lack visual design | Medium | M |
| Many pages are client-side only (could leverage RSC more) | Low | L |

### 1.3 Backend Architecture Observations

**Strengths:**
- Comprehensive schema with proper indexes
- Atomic accession number generation with scope support
- Centralized RBAC in `utils/permissions.ts`
- Complete library integration (11 domain files)
- Proper Zod validation on email sending

**Gaps:**
| Issue | Severity | Fix Effort |
|-------|----------|------------|
| Missing `returns` validators in `library/*.ts` functions | Medium | S |
| No cron jobs implemented (overdue fine calculation, etc.) | Medium | M |
| `inviteUser` mutation TODO: email invitation not implemented | High | M |
| Dashboard analytics uses `.filter()` in memory (performance) | Medium | M |
| Some queries collect all docs then filter (should use indexes) | Medium | M |

### 1.4 i18n Coverage

**Current State:** Only 3 locales (en, fr, es) with ~60 keys each covering:
- Dashboard header/description
- Settings (avatar, delete account)
- Activity (filters, entity types)

**Missing Coverage:**
- All module names (Collections, Loans, etc.)
- Form labels and validation messages
- Button text across the app
- Error messages
- Success toasts
- Empty states
- Library module strings

### 1.5 Testing Infrastructure

**Current State:**
- Vitest + edge-runtime configured
- `convex-test` installed
- One example test file (`loans.test.ts`) exists
- Testing strategy documented but not executed

**Gaps:**
- No tests for permission logic
- No tests for workflow state transitions
- No frontend component tests
- No E2E tests

---

## Part 2: Redesign Plan

### 2.1 Design System Derivation

Since the reference design (museumlite.aura.build) could not be fetched, derive design tokens from the existing codebase and refine based on these principles:

**Current Design System (from codebase):**
```
Colors:
- Background: bg-secondary (light), bg-black (dark)
- Cards: bg-card (light), bg-black (dark)
- Borders: border-border, border-white/10 (dark)
- Text: text-primary, text-primary/60, text-muted-foreground

Typography:
- Headings: text-xl font-medium (page titles), text-lg font-semibold (card titles)
- Body: text-sm, text-base
- Muted: text-xs, text-sm text-muted-foreground

Spacing:
- Page padding: px-6 py-8
- Card padding: p-6
- Gap: gap-4, gap-6
- Max width: max-w-screen-xl

Components:
- Cards: rounded-lg border border-border bg-card
- Buttons: shadcn/ui Button with variants
- Forms: shadcn/ui Input, Select, Textarea
- Tables: Custom list components (not shadcn Table)
```

### 2.2 Component Standardization

**Shared Components Needed (packages/ui):**
| Component | Purpose | Priority |
|-----------|---------|----------|
| `DataTable` | Standardized table with sorting/filtering/pagination | High |
| `EmptyState` | Consistent empty state with icon, title, description, action | High |
| `LoadingSkeleton` | Skeleton loading for cards, tables, forms | Medium |
| `StatusBadge` | Consistent status display (pending/active/etc.) | Medium |
| `PageHeader` | Title, description, actions container | Medium |
| `FilterBar` | URL-persisted filters using nuqs | Medium |
| `FormSection` | Grouped form fields with title/description | Low |

### 2.3 Page-by-Page Redesign Checklist

| Page | Current Issues | Acceptance Criteria |
|------|----------------|---------------------|
| Dashboard | Good | - |
| Objects List | Good layout, filters not URL-persisted | Filters use nuqs, skeleton loading |
| Object Detail | Good | Add print stylesheet |
| Object Form | Long form, no sections collapsed by default | Collapsible sections, better UX |
| Collections List | Good | - |
| Loans List | Good | - |
| Loan Detail | Good | - |
| Accessions List | Good | - |
| Deaccessions List | Good | - |
| Locations | Tree is functional but plain | Better visual hierarchy |
| Library Dashboard | Stats hardcoded | Real stats from queries |
| Library Circulation | Good | - |
| Settings Pages | Functional | Better organization |

---

## Part 3: Completion Backlog

### Milestone 1: Critical Fixes (Priority 1)

| ID | Title | Scope | Estimate | Acceptance Criteria |
|----|-------|-------|----------|---------------------|
| M1-1 | Library dashboard real stats | Backend | S | `getLibraryStats` query returns real counts |
| M1-2 | Invitation email implementation | Backend/Email | M | `inviteUser` sends email via Resend |
| M1-3 | Add `returns` validators to library functions | Backend | S | All queries/mutations in `library/*.ts` have `returns` |
| M1-4 | Fix dashboard analytics performance | Backend | M | Use indexes instead of `.filter()` in memory |

### Milestone 2: Missing Modules (Priority 2)

| ID | Title | Scope | Estimate | Acceptance Criteria |
|----|-------|-------|----------|---------------------|
| M2-1 | Exhibitions module UI | Frontend/Backend | L | List, detail, create, edit pages; linked to objects |
| M2-2 | Conservation tracking UI | Frontend/Backend | L | Treatment list, detail, scheduling |
| M2-3 | Donors management UI | Frontend/Backend | M | Donor list, detail, link to objects |
| M2-4 | Workflow configuration UI | Frontend | M | Settings page to configure approval workflows |

### Milestone 3: Polish & UX (Priority 2)

| ID | Title | Scope | Estimate | Acceptance Criteria |
|----|-------|-------|----------|---------------------|
| M3-1 | URL-persisted filters (nuqs) | Frontend | M | Objects, Loans, Accessions pages use nuqs |
| M3-2 | Empty state components | Frontend/UI | S | Consistent EmptyState component used everywhere |
| M3-3 | Skeleton loading states | Frontend/UI | S | LoadingSkeleton replaces "Loading..." text |
| M3-4 | Form validation standardization | Frontend | L | All forms use React Hook Form + Zod |
| M3-5 | Print stylesheets | Frontend | S | Object detail page prints cleanly |

### Milestone 4: i18n Expansion (Priority 3)

| ID | Title | Scope | Estimate | Acceptance Criteria |
|----|-------|-------|----------|---------------------|
| M4-1 | Extract all hardcoded strings | Frontend | L | All UI text goes through i18n |
| M4-2 | Translate to French | i18n | M | 100% French coverage |
| M4-3 | Translate to Spanish | i18n | M | 100% Spanish coverage |
| M4-4 | Add Norwegian locale | i18n | M | Full Norwegian translation |

### Milestone 5: Infrastructure (Priority 3)

| ID | Title | Scope | Estimate | Acceptance Criteria |
|----|-------|-------|----------|---------------------|
| M5-1 | Backend tests for workflows | Testing | M | Loan, accession, deaccession workflows tested |
| M5-2 | Backend tests for permissions | Testing | S | Permission checks tested |
| M5-3 | Overdue fine cron job | Backend | M | Daily job calculates/updates fines |
| M5-4 | Import/Export tools | Full-stack | L | CSV import wizard, export options |

### Milestone 6: Advanced Features (Priority 4)

| ID | Title | Scope | Estimate | Acceptance Criteria |
|----|-------|-------|----------|---------------------|
| M6-1 | Bulk actions on lists | Frontend | M | Multi-select, bulk status change |
| M6-2 | Media gallery enhancements | Frontend | M | PDF preview, document section |
| M6-3 | Advanced search | Full-stack | L | Boolean operators, saved searches |
| M6-4 | Public object view | Full-stack | L | Shareable public links for objects |

---

## Part 4: Workflow & Approval System

### 4.1 Development Cycle

```
1. SPEC (Define)
   └── Create Linear issue with requirements
   └── If UI change: Create Figma mockup or reference

2. IMPLEMENT (Build)
   └── Create feature branch: `mirzacmarius/mus-XXX-description`
   └── Implement with tests where applicable
   └── Self-review: lsp_diagnostics clean, build passes

3. REVIEW (Verify)
   └── Move issue to "In Review"
   └── Manual testing against checklist
   └── Code review (if team > 1)

4. APPROVE (Gate)
   └── Verify all acceptance criteria met
   └── Verify no regressions
   └── Merge and deploy
```

### 4.2 Approval Checkpoints

| Checkpoint | When | Criteria |
|------------|------|----------|
| **Design Approval** | Before implementation of any visual change | Mockup/design approved |
| **Schema Approval** | Before adding/modifying tables | Schema changes reviewed for indexes, performance |
| **API Approval** | Before adding public endpoints | Return validators, permissions checked |
| **Release Candidate** | Before each milestone completion | All issues in milestone pass QA |

### 4.3 QA Checklist Template

```markdown
## Pre-Release Checklist for [Feature/Milestone]

### Functionality
- [ ] All acceptance criteria verified
- [ ] Happy path works
- [ ] Error cases handled gracefully
- [ ] Permission checks enforced

### UI/UX
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Dark mode works
- [ ] Loading states present
- [ ] Empty states present
- [ ] Error states present
- [ ] Accessibility (keyboard nav, screen reader)

### Performance
- [ ] No unnecessary re-renders
- [ ] Large lists paginated
- [ ] Images optimized

### Code Quality
- [ ] TypeScript strict mode passes
- [ ] No linting errors
- [ ] No `any` types
- [ ] Return validators on all functions
```

---

## Part 5: Linear Project Setup

### 5.1 Project Structure

**Existing Project:** "Museumlite Development" (already created)

**Recommended Labels:**
| Label | Purpose |
|-------|---------|
| `priority-1` | Critical (blocking) |
| `priority-2` | High (next sprint) |
| `priority-3` | Medium (backlog) |
| `frontend` | Frontend work |
| `backend` | Backend work |
| `workflow` | Workflow/state machine work |
| `i18n` | Translation work |
| `testing` | Test infrastructure |
| `enhancement` | Polish/improvement |
| `bug` | Bug fix |

### 5.2 Milestones/Cycles

| Cycle | Duration | Focus |
|-------|----------|-------|
| **Sprint 1** | 2 weeks | Milestone 1 (Critical Fixes) |
| **Sprint 2** | 2 weeks | Milestone 2 (Missing Modules - part 1) |
| **Sprint 3** | 2 weeks | Milestone 2 (Missing Modules - part 2) |
| **Sprint 4** | 2 weeks | Milestone 3 (Polish & UX) |
| **Sprint 5** | 2 weeks | Milestone 4 + 5 (i18n + Infrastructure) |
| **Sprint 6** | 2 weeks | Milestone 6 (Advanced Features) + Buffer |

### 5.3 Existing Issues Status

From the current Linear project:
- **Done:** MUS-93, MUS-97, MUS-98 (Collections edit, Accounts CRM, Collection Groups)
- **In Review:** MUS-92, MUS-94, MUS-95, MUS-96 (Patrons edit, Loans workflow, Object/Collection delete)
- **Backlog:** MUS-99 through MUS-104 (Exhibitions, Conservation, Workflow config, Import/Export, etc.)

---

## Part 6: Recommended Immediate Actions

### This Week (Quick Wins)

1. **Close In-Review Issues** - Merge MUS-92, MUS-94, MUS-95, MUS-96 after final verification
2. **Library Stats Fix (M1-1)** - Create and wire up `getLibraryStats` query (2-3 hours)
3. **Add Return Validators (M1-3)** - Audit and add to `library/*.ts` (1-2 hours)

### Next Sprint

1. **Invitation Emails (M1-2)** - Implement email flow for user invitations
2. **Exhibitions Module (M2-1)** - Start with list and detail pages
3. **Empty State Components (M3-2)** - Create reusable component, apply across app

---

## Appendix A: File Locations Quick Reference

| Area | Location |
|------|----------|
| Dashboard pages | `apps/app/src/app/[locale]/(dashboard)/` |
| App components | `apps/app/src/components/` |
| Shared UI | `packages/ui/src/components/` |
| Convex functions | `packages/backend/convex/` |
| Library integration | `packages/backend/convex/library/` |
| Schema | `packages/backend/convex/schema.ts` |
| Locales | `apps/app/src/locales/` |
| Email templates | `packages/backend/convex/email/templates/` |
| Tests | `packages/backend/convex/*.test.ts` |

## Appendix B: Key Dependencies

| Package | Purpose |
|---------|---------|
| `@convex-dev/auth` | Authentication |
| `@convex-dev/polar` | Billing integration |
| `@tanstack/react-form` | Form state management |
| `nuqs` | URL state (should be used more) |
| `lucide-react` | Icons |
| `convex-test` | Backend testing |
| `react-email` | Email templates |
