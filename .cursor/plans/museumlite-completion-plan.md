# MuseumLite App Completion Plan

**Generated:** 2026-01-09
**Updated from:** 2025-12-30 plan + comprehensive codebase analysis
**Project:** Museum/Library Collection Management SaaS
**Stack:** Turborepo, Next.js 15 App Router, Convex, Bun, Biome, Tailwind v4, shadcn/ui

---

## Executive Summary

MuseumLite is a Museum/Library Collection Management SaaS at ~80% completion. The backend schema (50+ tables) is mature, frontend has 58 pages with strong CRUD coverage. 

**Key Metrics:**
- **58 dashboard pages** implemented
- **50+ database tables** with comprehensive indexes
- **~180 backend functions** across 40+ files
- **Sidebar:** ~90% functional

**Key Gaps:**
- Orphaned schema tables (webhooks, apiKeys, importJobs, serials)
- Incomplete library module UI (holds, vendors, circulation detail)
- Broken sidebar filters and redundancies
- Missing industry-standard features (insurance tracking, condition reports UI, rights management)

---

## Part 1: Current State Analysis

### 1.1 Linear Issues Status (as of 2026-01-09)

#### In Review (4) - Need Verification
| Issue | Title | Priority |
|-------|-------|----------|
| MUS-118 | Patrons and Accounts merge | priority-1 |
| MUS-95 | Objects: Add delete functionality | priority-1 |
| MUS-108 | Error Accession Number auto-generate | High |
| MUS-94 | Loans: Verify workflow completeness | priority-1 |

#### In Progress (1)
| Issue | Title |
|-------|-------|
| MUS-91 | Weblink field order swap |

#### Todo (10)
| Issue | Title | Priority |
|-------|-------|----------|
| MUS-119 | Theme switching not working | **URGENT** |
| MUS-121 | Collections: move delete to Settings | - |
| MUS-117 | UI/UX: Status Badges Components | priority-2 |
| MUS-114 | UI/UX: Dashboard Cards Redesign | priority-1 |
| MUS-113 | UI/UX: Sidebar Redesign | priority-1 |
| MUS-111 | Backup/Export feature | Feature |
| MUS-110 | Deaccession workflow (sold/archived/deleted) | - |
| MUS-109 | Add object to collections field | Medium |
| MUS-107 | Swap Physical Description/Provenance tabs | - |
| MUS-88 | Library reference info | Urgent |

#### Backlog (5)
| Issue | Title |
|-------|-------|
| MUS-116 | UI/UX: Object Detail Right Panel |
| MUS-104 | Bulk actions on list pages |
| MUS-103 | Media gallery enhancements |
| MUS-102 | Import/Export tools |
| MUS-67 | Loan items return |

### 1.2 Backend Schema Status

#### Core Tables (Complete)
- `organizations`, `users`, `userOrganizations`, `roles`, `permissions`, `rolePermissions`
- `auditLog`, `notifications`

#### Museum Tables (Complete Backend)
- `collections`, `collectionGroups`, `collectionGroupItems`
- `locations`, `locationHistory`
- `mediaFiles`
- `accessions`, `deaccessions`
- `loans`, `loanItems`, `loanDocuments`, `conditionReports`
- `exhibitions`, `conservationTreatments`

#### Module Details (Backend Complete, UI Read-Only)
- `fineArtDetails` - appraisedValue, insuranceCarrier, provenanceChain, shippingLogs
- `wineDetails` - vintage, peakWindow, binNumber, fillLevel, varietal
- `vehicleDetails` - vin, make, model, serviceLog, eventHistory
- `naturalHistoryDetails` - taxonomy, collectionDate, preservationMethod
- `archiveDetails` - documentType, retentionExpiresAt, confidentialityLevel

#### Library Tables (Mostly Complete)
- `libraryItems`, `itemCopies`
- `accounts` (unified patrons + museum accounts)
- `circulations`, `libraryHolds`, `libraryFines`, `libraryPayments`
- `libraryAcquisitionRequests`, `libraryVendors`
- `membershipTypes`

#### Orphaned Tables (Schema Only, No Logic)
| Table | Purpose | Status |
|-------|---------|--------|
| `webhooks` | External integrations | No CRUD |
| `apiKeys` | API access | No CRUD |
| `importJobs` | CSV/Media imports | No processing |
| `serialSubscriptions` | Magazine tracking | No logic |
| `serialIssues` | Serial issues | No logic |

### 1.3 Frontend Page Status

| Module | List | Detail | Create | Edit | Delete | Notes |
|--------|:----:|:------:|:------:|:----:|:------:|-------|
| Objects | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Collections | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Loans | ✅ | ✅ | ✅ | ✅ | ⚠️ | Missing individual delete |
| Exhibitions | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Conservation | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Accessions | ✅ | ✅ | ✅ | ✅ | ❌ | Workflow, no delete |
| Deaccessions | ✅ | ✅ | ✅ | ✅ | ❌ | Workflow, no delete |
| Locations | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Accounts | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Library Catalog | ✅ | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| Library Circulation | ✅ | ❌ | ❌ | ❌ | ❌ | List + dialogs only |
| Library Fines | ✅ | ❌ | ❌ | ❌ | ❌ | List + payment dialog |
| Library Acquisitions | ✅ | ❌ | ✅ | ❌ | ❌ | List + create only |
| Library Holds | ❌ | ❌ | ❌ | ❌ | ❌ | **MISSING** |
| Library Vendors | ❌ | ❌ | ❌ | ❌ | ❌ | **MISSING** |

### 1.4 Sidebar Navigation Issues

| Item | URL | Status | Issue |
|------|-----|--------|-------|
| Insurance & Audit | `/settings/activity` | ❌ | Misleading - redirects to Activity Log |
| Search Input | N/A | ❌ | Placeholder only, no functionality |
| Accessions | Listed twice | ⚠️ | Redundant (Workspace + Management) |
| Condition Reports | `/conservation?type=reports` | ⚠️ | Generic filter, no dedicated UI |

---

## Part 2: Phased Completion Plan

### PHASE 0: Bug Fixes & Critical Issues (1-2 days)
**Effort:** ~12 hours

#### 0.1 Verify In-Review Issues
| Issue | Files to Check | Effort |
|-------|----------------|--------|
| MUS-118 | `packages/backend/convex/accounts.ts`, `apps/app/.../accounts/` | 2h |
| MUS-95 | `apps/app/.../objects/[id]/page.tsx` | 1h |
| MUS-108 | `packages/backend/convex/utils/accessionCounter.ts` | 2h |
| MUS-94 | `packages/backend/convex/loans.ts`, `apps/app/.../loans/` | 2h |

#### 0.2 Fix Theme Switching (MUS-119 - URGENT)
**Files:**
- `apps/app/src/app/[locale]/(dashboard)/_components/theme-switcher.tsx`
- `packages/ui/src/components/*.tsx` - check hardcoded dark classes
- `apps/app/tailwind.config.ts`

**Effort:** 4-6 hours

#### 0.3 Complete MUS-91 Weblink Field Order
**Files:** `apps/app/.../objects/new/page.tsx`, `objects/[id]/edit/page.tsx`
**Effort:** 1 hour

---

### PHASE 1: Core Functionality Gaps (1 week)
**Effort:** ~32 hours

#### 1.1 Fix Sidebar Filter Issues (4h)
| Page | Fix |
|------|-----|
| `/objects/page.tsx` | Add `useSearchParams`, pass `collectionGroup` to query |
| `/exhibitions/page.tsx` | Filter by `status` param |
| `/conservation/page.tsx` | Filter by `type` param |

#### 1.2 Sidebar Cleanup (1h)
- Remove duplicate "New Arrivals"
- Rename "Insurance & Audit" → "Activity Log"
- Update `apps/app/src/components/app-sidebar.tsx`

#### 1.3 Library Module UI Completion (16h)
| Task | Files to Create | Effort |
|------|-----------------|--------|
| Circulation detail | `library/circulation/[id]/page.tsx` | 4h |
| Fines detail | `library/fines/[id]/page.tsx` | 3h |
| Acquisitions detail/edit | `library/acquisitions/[id]/page.tsx`, `[id]/edit/page.tsx` | 6h |
| Library dashboard stats | `packages/backend/convex/library/dashboard.ts` | 3h |

#### 1.4 Missing Delete Operations (6h)
| Module | Files | Effort |
|--------|-------|--------|
| Loans individual | `loans/[id]/page.tsx` | 2h |
| Accessions | `accessions/[id]/page.tsx` | 2h |
| Deaccessions | `deaccessions/[id]/page.tsx` | 2h |

#### 1.5 Quick UI Fixes (3h)
| Issue | Task | Files | Effort |
|-------|------|-------|--------|
| MUS-107 | Swap tabs | `objects/[id]/page.tsx` | 30m |
| MUS-109 | Add collection field | `objects/new/page.tsx`, `objects/[id]/edit/page.tsx` | 2h |
| MUS-121 | Move delete to Settings | `collections/[id]/page.tsx` | 30m |

---

### PHASE 2: Museum Module Completion (2 weeks)
**Effort:** ~76 hours

#### 2.1 Specialized Module Editing UI (20h)
Backend exists but UI is read-only. Create editable tabs:

| Module | Files to Create | Effort |
|--------|-----------------|--------|
| Fine Art | `objects/[id]/_components/fine-art-details-tab.tsx` | 4h |
| Wine | `objects/[id]/_components/wine-details-tab.tsx` | 4h |
| Vehicle | `objects/[id]/_components/vehicle-details-tab.tsx` | 4h |
| Natural History | `objects/[id]/_components/natural-history-details-tab.tsx` | 4h |
| Archive | `objects/[id]/_components/archive-details-tab.tsx` | 4h |

#### 2.2 Insurance & Valuation Tracking (8h)
Fields exist in `fineArtDetails`. Create:
- `objects/[id]/_components/insurance-panel.tsx`
- Insurance tab or side panel
- Reappraisal scheduling

#### 2.3 Standalone Condition Reports UI (16h)
| Files to Create | Purpose |
|-----------------|---------|
| `conservation/reports/page.tsx` | List all reports |
| `conservation/reports/[id]/page.tsx` | Report detail |
| `conservation/reports/new/page.tsx` | Create for any object |
| `packages/backend/convex/conditionReports.ts` | Object-centric (not loan-only) |

#### 2.4 Deaccession Workflow Enhancement - MUS-110 (8h)
Add disposal states: sold, archived, deleted

| Files | Changes |
|-------|---------|
| `packages/backend/convex/deaccessions.ts` | Add disposal methods |
| `deaccessions/[id]/page.tsx` | Disposal workflow UI |

#### 2.5 Import/Export Tools - MUS-102 (24h)
| Files to Create | Purpose |
|-----------------|---------|
| `apps/app/.../import/page.tsx` | CSV import wizard |
| `apps/app/.../export/page.tsx` | Export options |
| `packages/backend/convex/import.ts` | Import action |
| `packages/backend/convex/export.ts` | Export queries |

---

### PHASE 3: Library Module Completion (1 week)
**Effort:** ~50 hours

#### 3.1 Holds Management UI (8h)
| Files to Create |
|-----------------|
| `library/holds/page.tsx` |
| `library/holds/[id]/page.tsx` |

#### 3.2 Vendors Management UI (12h)
| Files to Create |
|-----------------|
| `library/vendors/page.tsx` |
| `library/vendors/[id]/page.tsx` |
| `library/vendors/new/page.tsx` |
| `library/vendors/[id]/edit/page.tsx` |
| `packages/backend/convex/library/vendors.ts` |

#### 3.3 Serials Management (16h)
Implement orphaned `serialSubscriptions`, `serialIssues` tables:

| Files to Create |
|-----------------|
| `packages/backend/convex/library/serials.ts` |
| `library/serials/page.tsx` |
| `library/serials/[id]/page.tsx` |

#### 3.4 Payment History UI (6h)
| Files to Create |
|-----------------|
| `library/payments/page.tsx` |
| Add tab to patron account detail |

#### 3.5 Patron Detail Enhancement (8h)
Enhance `accounts/[id]/page.tsx` for patron type:
- Checkout history
- Fine balance
- Hold queue
- Payment history

---

### PHASE 4: UI/UX Polish (1 week)
**Effort:** ~34 hours

#### 4.1 Status Badges Components - MUS-117 (4h)
Create: `packages/ui/src/components/status-badge.tsx`

Variants:
- Amber: Permanent collection
- Rose: On Display
- Cyan: In Transit
- Purple: Conservation

#### 4.2 Dashboard Cards Redesign - MUS-114 (8h)
- Collection cards with image backgrounds
- Gradient overlays
- Status badges integration
- Hover effects

#### 4.3 Sidebar Redesign - MUS-113 (8h)
- Global search with ⌘K functionality
- Better visual hierarchy
- Section improvements

#### 4.4 Object Detail Right Panel - MUS-116 (12h)
Create: `objects/[id]/_components/record-context-sidebar.tsx`
- Quick stats grid
- Provenance section
- Movement history timeline
- Tags display

#### 4.5 Move Delete to Settings - MUS-121 (2h)
Move delete button in `collections/[id]/page.tsx`

---

### PHASE 5: Advanced Features (2 weeks)
**Effort:** ~76 hours

#### 5.1 Bulk Actions - MUS-104 (16h)
- Multi-select checkboxes on all list pages
- Create `packages/ui/src/components/bulk-actions-bar.tsx`
- Bulk status change, delete, export

#### 5.2 Media Gallery Enhancements - MUS-103 (12h)
- PDF preview
- 3D viewer (Sketchfab embeds)
- Document section separation

#### 5.3 Global Search Implementation (16h)
- Create command palette (⌘K)
- `apps/app/src/components/global-search.tsx`
- `packages/backend/convex/search.ts`

#### 5.4 API Keys & Webhooks UI (20h)
Implement orphaned tables:
| Files to Create |
|-----------------|
| `packages/backend/convex/apiKeys.ts` |
| `packages/backend/convex/webhooks.ts` |
| `settings/developer/api-keys/page.tsx` |
| `settings/developer/webhooks/page.tsx` |

#### 5.5 Backup/Export - MUS-111 (12h)
- Normal account backup
- Export to Excel/XML/CSV
- Download backup files

---

## Part 3: Summary

### Effort Estimates

| Phase | Duration | Hours |
|-------|----------|-------|
| Phase 0: Bug Fixes | 1-2 days | ~12h |
| Phase 1: Core Gaps | 1 week | ~32h |
| Phase 2: Museum Completion | 2 weeks | ~76h |
| Phase 3: Library Completion | 1 week | ~50h |
| Phase 4: UI/UX Polish | 1 week | ~34h |
| Phase 5: Advanced Features | 2 weeks | ~76h |
| **TOTAL** | **~8 weeks** | **~280h** |

### Priority Order

**Week 1-2: Critical Path**
1. Phase 0 (all bug fixes)
2. Phase 1.1-1.2 (sidebar fixes)
3. MUS-109, MUS-107, MUS-121 (quick wins)

**Week 3-4: Library Focus**
1. Phase 1.3 (library UI completion)
2. Phase 3.1-3.2 (holds, vendors)

**Week 5-6: Museum Depth**
1. Phase 2.1 (module editing)
2. Phase 2.2-2.3 (insurance, condition reports)

**Week 7-8: Polish & Advanced**
1. Phase 4 (UI/UX)
2. Phase 5 (selectively based on priority)

---

## Appendix: File Locations

| Area | Location |
|------|----------|
| Dashboard pages | `apps/app/src/app/[locale]/(dashboard)/` |
| App components | `apps/app/src/components/` |
| Shared UI | `packages/ui/src/components/` |
| Convex functions | `packages/backend/convex/` |
| Library integration | `packages/backend/convex/library/` |
| Schema | `packages/backend/convex/schema.ts` |
| Locales | `apps/app/src/locales/` |
| Tests | `packages/backend/convex/*.test.ts` |
