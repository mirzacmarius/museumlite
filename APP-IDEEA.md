# MuseumLite Product Plan (Design → Implementation Backlog)

## Purpose
Build full feature parity with the provided HTML design using the current codebase (Next.js App Router + Convex). This document merges the original product vision with a concrete epic/task backlog sized for Linear.

## Guiding Principles
- Ship full parity with all modules shown in the HTML design.
- Use existing routes and Convex domains where available; only add new modules when missing.
- Ensure role-based permissions, audit logging, and workflows are consistent across modules.
- All features must support multi-tenant organizations.

## Existing App Surface (Detected)
- **Dashboard**: `apps/app/src/app/[locale]/(dashboard)/page.tsx`
- **Objects Catalog**: `apps/app/src/app/[locale]/(dashboard)/objects/*`
- **Collections / Groups**: `apps/app/src/app/[locale]/(dashboard)/collections/*`
- **Accessions**: `apps/app/src/app/[locale]/(dashboard)/accessions/*`
- **Deaccessions**: `apps/app/src/app/[locale]/(dashboard)/deaccessions/*`
- **Loans & Transport**: `apps/app/src/app/[locale]/(dashboard)/loans/*`
- **Locations**: `apps/app/src/app/[locale]/(dashboard)/locations/*`
- **Exhibitions**: `apps/app/src/app/[locale]/(dashboard)/exhibitions/*`
- **Conservation**: `apps/app/src/app/[locale]/(dashboard)/conservation/*`
- **Library**: `apps/app/src/app/[locale]/(dashboard)/library/*`
- **Settings**: `apps/app/src/app/[locale]/(dashboard)/settings/*`

Missing from routes but present in design:
- **Transit Log**
- **Installation Planning**
- **Public Portal / Publishing**
- **Insurance Policies** (beyond object fields)
- **Global Digital Assets Browser**

## Design → Implementation Matrix (Initial)
| Module | Design HTML (source) | App Routes (Next.js) | Convex/Backend | Gaps / Notes |
| --- | --- | --- | --- | --- |
| Dashboard | `aura-html-pages/index.html`, `aura-html-pages/dasboard-as-admin.html` | `/` (`apps/app/src/app/[locale]/(dashboard)/page.tsx`) | `api.dashboard.getAnalytics` (needs confirm) | Verify KPI semantics vs design. |
| Activity | `aura-html-pages/index.html` (activity section) | `/activity` (`apps/app/src/app/[locale]/(dashboard)/activity/page.tsx`) | Not confirmed | Confirm activity feed source. |
| Assignments | `aura-html-pages/my-assignments.html` | `/assignments` (`apps/app/src/app/[locale]/(dashboard)/assignments/page.tsx`) | Not confirmed | Wire assignments data source. |
| Objects Catalog | `aura-html-pages/collection.html` (list), `aura-html-pages/object.html`, `aura-html-pages/object-light.html` | `/objects`, `/objects/[id]`, `/objects/new` | `packages/backend/convex/collections.ts` | Validate list/grid parity + filters. |
| Collections / Groups | `collection-management-group-pages.html` | `/collections`, `/collections/[id]` | `packages/backend/convex/collectionGroups.ts` | Confirm group detail parity. |
| Accessions | `aura-html-pages/accessions.html`, `aura-html-pages/new-record.html` | `/accessions`, `/accessions/[id]`, `/accessions/new` | `packages/backend/convex/accessions.ts`, `packages/backend/convex/accessionTemplates.ts` | Workflow + templates parity. |
| Deaccessions | Not found yet in HTML | `/deaccessions`, `/deaccessions/[id]`, `/deaccessions/new` | `packages/backend/convex/deaccessions.ts` | Add design reference. |
| Loans & Transport | `aura-html-pages/loans.html`, `aura-html-pages/loans-overview*.html`, `aura-html-pages/outgoing-loans.html`, `aura-html-pages/loans-transport.html` | `/loans`, `/loans/[id]`, `/loans/new` | `packages/backend/convex/loans.ts` | Transport UI partial. |
| Locations | `aura-html-pages/location-and-tracking.html` | `/locations`, `/locations/[id]` | `packages/backend/convex/locations.ts` | Tree UI + occupancy gaps. |
| Exhibitions | Not found yet in HTML | `/exhibitions`, `/exhibitions/[id]`, `/exhibitions/new` | Not confirmed | Add design reference. |
| Conservation | Not found yet in HTML | `/conservation`, `/conservation/[id]`, `/conservation/new` | Not confirmed | Add design reference. |
| Library Catalog | `aura-html-pages/edit-patron-*.html` (patrons) | `/library/catalog`, `/library/catalog/[id]`, `/library/catalog/new` | `packages/backend/convex/library/items.ts` | Need catalog-specific design reference. |
| Library Circulation | Not found yet in HTML | `/library/circulation` | `packages/backend/convex/library/circulation.ts` | Add design reference. |
| Library Fines | Not found yet in HTML | `/library/fines` | Not confirmed | Add design reference. |
| Library Acquisitions | Not found yet in HTML | `/library/acquisitions` | `packages/backend/convex/library/acquisitions.ts` | Add design reference. |
| Accounts / CRM | Not found yet in HTML | `/accounts`, `/accounts/[id]`, `/accounts/new` | Not confirmed | Add design reference. |
| Digital Assets | Not found yet in HTML | Not present | `packages/backend/convex/media.ts` | Needs UI routes + global assets browser. |
| Transit Log | `aura-html-pages/loans-transport.html` (partial) | Not present | Not present | New module. |
| Installation Planning | Not found yet in HTML | Not present | Not present | New module. |
| Insurance | Not found yet in HTML | Not present | Not present | New module. |
| Public Portal | `museumlite.aura.build.html` | `apps/web` (TBD) | Not present | New module. |
| Settings | `aura-html-pages/index.html` (settings section) | `/settings/*` | Not confirmed | Validate settings parity. |

## Epic 0 — Foundations & Definition of Done
- Create Design → Implementation matrix for every sidebar module.
- Finalize naming conventions in UI (Objects vs Collections vs Collection Groups).
- Standardize page metadata: title, primary actions, breadcrumbs.
- Set Linear labels: `phase/*`, `module/*`, `frontend`, `backend`, `design`, `workflow`, `priority-*`.

### Definition of Done (Template)
- UI matches design reference for the screen(s) touched.
- Data is wired to Convex endpoints (no mock data left behind).
- Permissions checked on all mutations/queries.
- Activity + audit log entries generated where relevant.
- Empty/loading/error states handled.
- Tests or coverage notes added when applicable.
- No TypeScript errors; lint passes on touched files.

## Epic 1 — App Shell, Navigation, Global UX
- Global command palette (search + create actions).
- Unified search across objects, loans, accessions, library items, locations.
- Reusable right inspector panel for details (object, loan, collection group).
- Mobile layout parity: sidebar drawer, inspector drawer, responsive tables.

## Epic 2 — Permissions, Roles, Audit, Notifications
- Audit permissions coverage on all routes + mutations.
- Role management UI (create/edit roles, assign permissions).
- Notifications center (read/unread, links to workflow items).
- Audit log filters: user, entity type, time range.

## Epic 3 — Dashboard / Overview (HTML Parity)
- Dashboard KPIs from `api.dashboard.getAnalytics` (verify semantics).
- “Departments & Collections” grid as real collection groups.
- Recent activity log unifies accessions, deaccessions, loans, objects.
- CTA buttons (Add Object, New Exhibition) wired to flows.

## Epic 4 — Collection Groups (Departments)
- Collection Group CRUD (name, description, image, curator).
- Assign/unassign objects to groups (bulk + object detail).
- Group detail page KPIs and activity.
- Group-level access control (optional).

## Epic 5 — Object Catalog (List/Grid, Filters, Bulk Ops)
- List/grid toggle parity with saved views.
- Filters: group, status, location, period, culture, material, date acquired.
- Bulk actions: move, add to exhibition/loan, export, deaccession.
- Column customization per user.

## Epic 6 — Object Record Detail
- Tab parity: details, media, conservation, exhibitions, loans, location history.
- Provenance editor + ownership history.
- Public visibility controls and high-res download flags.
- Print/export object record sheet (PDF).

## Epic 7 — Digital Assets (Per-Object + Global)
- Global assets browser (filter by type, uploader, date, linked object).
- Upload UX: drag/drop, progress, validation, retries.
- Media metadata editing + primary image handling.
- Storage usage analytics by type and per object.

## Epic 8 — Accessions Workflow
- Kanban steps driven by `workflowConfigs`.
- Intake form, document attachments, donor/source linkage.
- Batch import workflow (CSV) + error reporting.
- Assignment support (tie to “My Assignments”).

## Epic 9 — Deaccessions Workflow
- Deaccession creation: reason, method, proceeds, approvals.
- Enforce object status transitions + audit log entries.
- Exports for board/collections committee.

## Epic 10 — Locations & Movement
- Locations tree UI + detail panel (gallery vs storage modes).
- Move object flow with reason + history.
- Capacity/occupancy tracking for rooms/cabinets/drawers.
- Environmental data fields (manual entry first).

## Epic 11 — Loans & Transport (Core)
- Loans list: incoming/outgoing tabs, filters, search.
- Loan detail: condition in/out, documents, approvals, timeline.
- Loan agreement generator + PDF storage.
- Enforce object state and location transitions.

## Epic 12 — Transit Log (New Module)
- Create transit records (route, carrier, tracking, ETA, status).
- Link shipments to loans/exhibitions/objects.
- Status changes + notifications.

## Epic 13 — Exhibitions Management
- Gallery vs timeline views (HTML parity).
- Exhibition detail: KPIs, included objects, approvals.
- Conflict checks with loans/other exhibitions.
- Attachments + object selection workflows.

## Epic 14 — Installation Planning (New Module)
- Task board by exhibition (todo/in-progress/done).
- Task templates: lighting, signage, mounts, conservation checks.
- Assignments + due dates + dependencies.

## Epic 15 — Conservation & Care
- Treatment workflow (propose → approve → in progress → complete).
- Attachments: before/after photos, reports.
- Alerts for critical attention.

## Epic 16 — Insurance & Audit (New Module)
- Insurance policies CRUD (carrier, coverage, premium schedule).
- Link policies to objects/exhibitions/loans.
- Expiry and missing-coverage alerts.
- Claims tracking + documents.

## Epic 17 — Library & Research
- Library catalog polish: full CRUD + ISBN auto-fill.
- Patron management polish: membership, limits, statuses.
- Circulation desk: checkout, return, renew, holds.
- Fines: accrual, payments, waivers, receipts.
- Acquisitions workflow: request → approval → ordered → received.

## Epic 18 — Public Portal / Publishing (New Module)
- Public site routes (apps/web) for searchable collection.
- Publishing settings: public URL slug, public search toggle, high-res toggle.
- Public object page with redaction rules.
- SEO, sitemap, per-org branding.

## Epic 19 — Data Import/Export & Integrations
- CSV import/export for objects, accessions, locations, accounts.
- Media bulk import jobs.
- Webhooks + API keys UI.

## Epic 20 — Subscription Tiers & Feature Gating
- Define tier entitlements (Free/Pro/Enterprise) for core platform modules.
- Integration access is handled via **per‑integration subscriptions** (add-ons), not tier bundling.
- Frontend + backend feature gate utility (Convex + UI guardrails).
- Use `enabledModules` and `enabledIntegrations` to toggle optional modules and add-ons.
- Upgrade prompts and “locked feature” UX in settings/nav.
- Usage limits/quotas (objects, media storage, users, exports).

### Proposed Tiering (Draft)
- **Free**: Core catalog (objects, collections, locations), basic accessions/deaccessions, basic media (limited storage), limited users.
- **Pro**: Loans, exhibitions, conservation, digital assets, reporting, public portal.
- **Enterprise**: Custom workflows, advanced reporting/compliance, SLA features, advanced permissions.

### Integration Add‑Ons (Draft)
- Library module (patrons/circulation/fines/acquisitions)
- Authority control (Getty AAT/ULAN/TGN)
- IIIF high‑res serving
- OAI‑PMH harvesting endpoint
- External CMS connectors (CollectionSpace, TMS, PastPerfect, ArchivesSpace)
- RFID/Barcode inventory workflows

## Epic 21 — Domain Integrations (Cataloging Ecosystem)
- Standards import/export: LIDO, CDWA, Dublin Core, MARC21.
- Authority control integration: Getty AAT/ULAN/TGN lookup.
- IIIF image server integration for high-res/public viewing.
- OAI-PMH endpoint for public catalog harvesting.
- External CMS import adapters (CollectionSpace, TMS, PastPerfect, ArchivesSpace).

## Epic 22 — Reporting & Analytics
- Inventory valuation, loan calendar, exhibition pipeline, conservation backlog.
- Compliance/audit reports (accession/deaccession approvals).
- Location occupancy and storage utilization analytics.
- Exports: CSV/PDF for board and insurer reporting.

## Epic 23 — Accounts & Institution CRM
- Account detail page with contacts, notes, documents, activity timeline.
- Relationship mapping between institutions and loans/exhibitions.
- Patron segmentation and bulk communications.

## Epic 24 — Workflow Engine Hardening
- Unified workflow system for accessions/loans/deaccessions/exhibitions/conservation.
- SLA timers, escalations, and role-based inbox.
- Audit trail for approvals + rollback support.

## Epic 25 — QA, Seed Data, Tests
- Extend Convex tests: accessions, deaccessions, loans, locations.
- Seed data for media, loan docs, workflows, integrations (per `SEED_DATA_SUMMARY.md`).
- UI empty/loading/error states for every module.

## Additional Known TODOs to Merge
- **Accession number format UI**: implement frontend configuration in `settings/organization` (see `ACCESSION_NUMBER_FORMAT_IMPLEMENTATION.md` TODO section).
- **Workflow configs**: add seed defaults and configuration UI for accessions/loans/deaccessions/exhibitions.
- **Media/loan docs demo data**: add minimal seed flow once storage setup exists.

---

## Notes
This backlog is designed for Linear epics/issues/subtasks. Use this as the source of truth for project management and break down each epic into granular implementation tasks during execution.

