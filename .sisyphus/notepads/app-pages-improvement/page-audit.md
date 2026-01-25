# Page Audit: Loading States

## Summary
- **Total pages**: 66
- **Pages WITH loading.tsx**: 7 (10.6%)
- **Pages NEEDING loading.tsx**: 59

> Note: Task stated 68 pages and that analytics has loading.tsx - actual findings differ. Analytics does NOT have loading.tsx.

---

## Pages WITH Loading States (7)

| Page | Path | Notes |
|------|------|-------|
| Dashboard (root) | `/(dashboard)/page.tsx` | Main dashboard |
| Objects | `/(dashboard)/objects/page.tsx` | Objects list |
| Loans | `/(dashboard)/loans/page.tsx` | Loans list |
| Accounts | `/(dashboard)/accounts/page.tsx` | Accounts list |
| Locations | `/(dashboard)/locations/page.tsx` | Locations list |
| Accessions | `/(dashboard)/accessions/page.tsx` | Accessions list |
| Collections | `/(dashboard)/collections/page.tsx` | Collections list |

---

## Pages NEEDING Loading States (Prioritized)

### Priority 1: Critical (High Traffic Main Pages) - 10 pages

| # | Page | Path | Rationale |
|---|------|------|-----------|
| 1 | **Exhibitions** | `/exhibitions/page.tsx` | Main module page, complex timeline view, multiple queries, feature-gated |
| 2 | **Analytics** | `/analytics/page.tsx` | Dashboard with 6+ card components, multiple `useQuery` calls for KPIs/compliance/charts |
| 3 | **Conservation** | `/conservation/page.tsx` | Main module page, data table, feature-gated |
| 4 | **Library Catalog** | `/library/catalog/page.tsx` | Large table with filters/search, item type selector |
| 5 | **Library Dashboard** | `/library/page.tsx` | Stats dashboard, multiple queries for library metrics |
| 6 | **Deaccessions** | `/deaccessions/page.tsx` | Workflow page, data table with search |
| 7 | **Media** | `/media/page.tsx` | File grid view, complex UI with dialogs, storage queries |
| 8 | **Activity** | `/activity/page.tsx` | Activity feed with filters, date range selector |
| 9 | **Assignments** | `/assignments/page.tsx` | Task list, user assignments query |
| 10 | **Notifications** | `/notifications/page.tsx` | Notification center, tabs, multiple categories |

### Priority 2: Important (Detail Pages) - 10 pages

| # | Page | Path | Rationale |
|---|------|------|-----------|
| 11 | Object Detail | `/objects/[id]/page.tsx` | Full object view, media, provenance, history |
| 12 | Loan Detail | `/loans/[id]/page.tsx` | Loan workflow, documents, timeline |
| 13 | Account Detail | `/accounts/[id]/page.tsx` | Contact info, related loans/exhibitions |
| 14 | Collection Detail | `/collections/[id]/page.tsx` | Collection overview, object list |
| 15 | Exhibition Detail | `/exhibitions/[id]/page.tsx` | Exhibition info, object checklist |
| 16 | Conservation Detail | `/conservation/[id]/page.tsx` | Treatment details, images, reports |
| 17 | Accession Detail | `/accessions/[id]/page.tsx` | Accession workflow, documents |
| 18 | Deaccession Detail | `/deaccessions/[id]/page.tsx` | Deaccession records, approvals |
| 19 | Location Detail | `/locations/[id]/page.tsx` | Location info, contained objects |
| 20 | Library Item Detail | `/library/catalog/[id]/page.tsx` | Catalog record, availability |

### Priority 3: Secondary (Less Frequent List Pages) - 8 pages

| # | Page | Path | Rationale |
|---|------|------|-----------|
| 21 | Library Circulation | `/library/circulation/page.tsx` | Check-in/check-out, patron queries |
| 22 | Library Acquisitions | `/library/acquisitions/page.tsx` | Acquisition records |
| 23 | Library Fines | `/library/fines/page.tsx` | Fine management, patron lookup |
| 24 | Settings - Workflows | `/settings/workflows/page.tsx` | Workflow configuration, org settings |
| 25 | Settings - Users | `/settings/users/page.tsx` | User management, invitations |
| 26 | Settings - Activity | `/settings/activity/page.tsx` | Audit log viewer |
| 27 | Settings - Roles | `/settings/roles/page.tsx` | Role/permission management |
| 28 | Settings - Organization | `/settings/organization/page.tsx` | Organization settings |

### Priority 4: Lower (Forms, Imports, Misc Settings) - 31 pages

**Form Pages (Creation):**
- `/objects/new/page.tsx`
- `/loans/new/page.tsx`
- `/accounts/new/page.tsx`
- `/collections/new/page.tsx`
- `/exhibitions/new/page.tsx`
- `/conservation/new/page.tsx`
- `/accessions/new/page.tsx`
- `/deaccessions/new/page.tsx`
- `/library/catalog/new/page.tsx`
- `/organizations/new/page.tsx`

**Form Pages (Edit):**
- `/objects/[id]/edit/page.tsx`
- `/loans/[id]/edit/page.tsx`
- `/accounts/[id]/edit/page.tsx`
- `/collections/[id]/edit/page.tsx`
- `/exhibitions/[id]/edit/page.tsx`
- `/conservation/[id]/edit/page.tsx`
- `/accessions/[id]/edit/page.tsx`
- `/deaccessions/[id]/edit/page.tsx`
- `/library/catalog/[id]/edit/page.tsx`

**Import Pages:**
- `/locations/import/page.tsx`
- `/accessions/import/page.tsx`
- `/accounts/import/page.tsx`
- `/collections/import/page.tsx`
- `/collections/media-import/page.tsx`

**Settings (Less Critical):**
- `/settings/page.tsx` - User profile settings
- `/settings/billing/page.tsx` - Subscription management
- `/settings/developer/page.tsx` - API keys
- `/settings/data/page.tsx` - Data management
- `/settings/integrations/page.tsx` - Integrations
- `/settings/integrations/library/page.tsx` - Library integrations
- `/settings/modules/page.tsx` - Module toggles

---

## Complexity Analysis

### High Complexity Pages (multiple queries, complex UI)
| Page | Queries | UI Complexity |
|------|---------|---------------|
| Analytics | 3+ (KPIs, compliance, location util) | 6+ card components, charts |
| Exhibitions | 3+ (list, saved view, viewMode) | Timeline view, filters, status cards |
| Library Dashboard | 2+ (settings, stats) | Stats grid, quick actions |
| Media | 2+ (files, storage) | Grid/list toggle, dialogs, upload |
| Notifications | 2+ (notifications, counts) | Tabs, category filters |

### Medium Complexity Pages (1-2 queries, tables/lists)
- Conservation, Deaccessions, Library Catalog
- All detail pages (`/[id]/page.tsx`)
- Assignments, Activity

### Low Complexity Pages (forms, static content)
- All `/new/` and `/edit/` pages
- Import pages
- Most settings pages

---

## Recommendations

### Immediate Action (Sprint 1)
Implement loading states for **Priority 1** (10 pages):
- These are high-traffic pages users see daily
- Complex UIs benefit most from skeleton loading
- exhibitions, analytics, conservation, library/*, media, activity, assignments, notifications

### Next Sprint (Sprint 2)
Implement for **Priority 2** (10 detail pages):
- Detail pages load single records but can have slow initial loads
- User navigates here from list pages, expects continuity

### Defer/Optional (Sprint 3+)
- **Priority 3**: Settings pages, less frequent access
- **Priority 4**: Form pages (forms typically render quickly, less benefit)

---

## File Structure Reference

```
apps/app/src/app/[locale]/(dashboard)/
├── page.tsx                          # Dashboard (HAS loading.tsx)
├── loading.tsx                       # 
├── objects/
│   ├── page.tsx                      # HAS loading.tsx
│   ├── loading.tsx
│   ├── new/page.tsx
│   └── [id]/
│       ├── page.tsx                  # NEEDS loading.tsx (P2)
│       └── edit/page.tsx
├── loans/                            # HAS loading.tsx
├── accounts/                         # HAS loading.tsx
├── locations/                        # HAS loading.tsx
├── accessions/                       # HAS loading.tsx
├── collections/                      # HAS loading.tsx
├── exhibitions/                      # NEEDS loading.tsx (P1)
├── conservation/                     # NEEDS loading.tsx (P1)
├── analytics/                        # NEEDS loading.tsx (P1)
├── media/                            # NEEDS loading.tsx (P1)
├── activity/                         # NEEDS loading.tsx (P1)
├── assignments/                      # NEEDS loading.tsx (P1)
├── notifications/                    # NEEDS loading.tsx (P1)
├── deaccessions/                     # NEEDS loading.tsx (P1)
├── library/
│   ├── page.tsx                      # NEEDS loading.tsx (P1)
│   ├── catalog/page.tsx              # NEEDS loading.tsx (P1)
│   ├── circulation/page.tsx          # NEEDS loading.tsx (P3)
│   ├── acquisitions/page.tsx         # NEEDS loading.tsx (P3)
│   └── fines/page.tsx                # NEEDS loading.tsx (P3)
└── settings/                         # Various (P3-P4)
```

---

*Audit completed: $(date)*
*Total implementation effort: ~59 loading.tsx files needed*
*Recommended phased approach: P1 (10) → P2 (10) → P3 (8) → P4 (31)*

---

## Notes
- Object comments backend (`packages/backend/convex/objectComments.ts`) and schema already existed; added mention support + notifications + UI comments tab.
- Object detail page uses tabbed layout; comments integrated as new tab.
- Notifications link helper now supports `object` entity type for `/objects/{id}`.
