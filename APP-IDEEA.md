# MuseumLite Product Plan (Design → Implementation Backlog)

## Purpose
Build full feature parity with the provided HTML design using the current codebase (Next.js App Router + Convex). This document merges the original product vision with a concrete epic/task backlog sized for Linear.

## Guiding Principles
- Ship full parity with all modules shown in the HTML design.
- Use existing routes and Convex domains where available; only add new modules when missing.
- Ensure role-based permissions, audit logging, and workflows are consistent across modules.
- All features must support multi-tenant organizations.

## Scope
**Timeline: Full product delivery in 6 months.** This plan covers the complete MuseumLite platform—not an MVP, but a production-ready SaaS with all core and advanced modules operational.

### Modules in Scope
- **Core Catalog**: Objects, Collections/Groups, Locations, Digital Assets
- **Workflows**: Accessions, Deaccessions, Loans, Exhibitions, Conservation, Installation Planning
- **Operations**: Transit Log, Insurance & Audit, Accounts/CRM
- **Library**: Catalog, Circulation, Fines, Acquisitions, Patron Management
- **Reporting**: Analytics, Compliance Reports, Inventory Valuation
- **Public Portal**: Searchable collection, publishing controls, SEO
- **Platform**: Permissions, Audit Logging, Notifications, Workflow Engine, Feature Gating

### Success Criteria
- All modules have UI parity with design reference.
- All mutations/queries protected by role-based permissions.
- Audit log entries generated for all state changes.
- Multi-tenant isolation enforced at database layer.
- Feature gating supports Free/Pro/Enterprise tiers + integration add-ons.

## Guardrails
**No deviations from the current stack.** These constraints ensure execution velocity and minimize risk:

- **No new frameworks or languages**: Stay on Next.js 15 App Router + Convex + Bun + TypeScript.
- **No external SaaS dependencies**: All auth, storage, jobs, and database via Convex. No third-party workflow engines, no external CMS.
- **No auth provider changes**: Continue with Convex Auth (Google OAuth). No Clerk, Auth0, or other providers.
- **No new UI libraries**: Stick with TailwindCSS v4 + shadcn/ui. No Material-UI, Chakra, or other component libraries.
- **No database migrations**: Schema changes only via Convex schema.ts. No raw SQL, no external migrations.

## Dependencies
**Core platform dependencies** (to be expanded during execution):

- **Workflow Engine**: Kanban-driven state machine for accessions, loans, deaccessions, exhibitions, conservation. Built on Convex mutations + workflowConfigs schema.
- **Media & Storage**: Convex storage for object images, documents, conservation photos. Metadata in `media` table.
- **Search**: Full-text search across objects, library items, accounts. Built on Convex indexes + client-side filtering.
- **Permissions**: Role-based access control (RBAC) with organization-level and object-level rules. Enforced in Convex queries/mutations.
- **Audit Log**: Immutable log of all mutations (create, update, delete) with user, timestamp, entity type, changes. Queryable by user, entity, time range.
- **Notifications**: In-app notification center for workflow assignments, approvals, alerts. Linked to audit log events.

## Shared Services
**Platform-level services** used across all modules:

- **Authentication & Authorization**: Convex Auth + role-based permissions middleware.
- **Activity Feed**: Unified activity log aggregating accessions, deaccessions, loans, objects, exhibitions, conservation.
- **Bulk Operations**: Bulk move, bulk export, bulk deaccession across objects and loans.
- **Search & Filtering**: Global search + module-specific filters (status, location, date, culture, material).
- **Reporting & Export**: CSV/PDF export for objects, loans, accessions, deaccessions, exhibitions, reports.
- **Workflow State Machine**: Shared Kanban engine for all workflow modules.
- **Media Management**: Centralized upload, metadata, storage usage tracking.
- **Notifications & Alerts**: In-app center + email notifications for assignments, approvals, expiries.

## Data/API Map
**Schema coverage and API endpoints per module** (placeholder; to be populated during execution):

| Module | Tables | Key Queries | Key Mutations | Notes |
| --- | --- | --- | --- | --- |
| Objects | `objects`, `media`, `objectHistory` | `getObject`, `listObjects`, `searchObjects` | `createObject`, `updateObject`, `deleteObject`, `moveObject` | Full CRUD + media + location history. |
| Collections | `collectionGroups`, `objectGroupAssignments` | `getGroup`, `listGroups` | `createGroup`, `updateGroup`, `assignObjects` | Group detail + KPIs. |
| Accessions | `accessions`, `accessionItems`, `accessionDocuments`, `workflowConfigs` | `getAccession`, `listAccessions` | `createAccession`, `updateAccession`, `approveAccession`, `completeAccession` | Workflow-driven intake. |
| Deaccessions | `deaccessions`, `deaccessionItems` | `getDeaccession`, `listDeaccessions` | `createDeaccession`, `approveDeaccession`, `executeDeaccession` | Approval + audit trail. |
| Loans | `loans`, `loanItems`, `loanDocuments` | `getLoan`, `listLoans`, `getOutgoingLoans` | `createLoan`, `updateLoan`, `approveLoan`, `returnLoan` | Condition in/out + transport. |
| Locations | `locations`, `objectLocations` | `getLocation`, `listLocations`, `getOccupancy` | `createLocation`, `updateLocation`, `moveObject` | Tree + occupancy. |
| Exhibitions | `exhibitions`, `exhibitionObjects` | `getExhibition`, `listExhibitions` | `createExhibition`, `updateExhibition`, `addObjects`, `approveExhibition` | Gallery + timeline views. |
| Conservation | `conservationTreatments`, `conservationDocuments` | `getTreatment`, `listTreatments` | `createTreatment`, `updateTreatment`, `completeTreatment` | Workflow-driven care. |
| Library | `libraryItems`, `libraryPatrons`, `libraryCirculation`, `libraryFines` | `getItem`, `listItems`, `getPatron` | `createItem`, `checkoutItem`, `returnItem`, `createFine` | Full circulation. |
| Accounts | `accounts`, `accountContacts`, `accountDocuments` | `getAccount`, `listAccounts` | `createAccount`, `updateAccount` | CRM + relationship mapping. |
| Digital Assets | `media`, `mediaMetadata` | `getMedia`, `listMedia`, `getStorageUsage` | `uploadMedia`, `updateMediaMetadata`, `deleteMedia` | Global assets browser. |
| Transit Log | `transitRecords`, `shipments` | `getTransit`, `listTransits` | `createTransit`, `updateTransitStatus` | Tracking + notifications. |
| Insurance | `insurancePolicies`, `insuranceClaims` | `getPolicy`, `listPolicies`, `getClaims` | `createPolicy`, `updatePolicy`, `createClaim` | Coverage + expiry alerts. |
| Installation | `installationTasks`, `taskTemplates` | `getTasks`, `listTasks` | `createTask`, `updateTask`, `completeTask` | Task board + dependencies. |

## Integrations
**External integrations and data exchange** (to be expanded during execution):

### Data Import/Export (Epic 19)
- **CSV Import/Export**: Objects, accessions, locations, accounts, library items.
- **Media Bulk Import**: Batch upload with metadata mapping.
- **Webhooks & API Keys**: Custom integrations via HTTP endpoints.

### Cataloging Ecosystem (Epic 21)
- **Standards**: LIDO, CDWA, Dublin Core, MARC21 import/export.
- **Authority Control**: Getty AAT/ULAN/TGN lookup integration.
- **IIIF**: High-res image server for public viewing.
- **OAI-PMH**: Endpoint for public catalog harvesting.
- **CMS Adapters**: CollectionSpace, TMS, PastPerfect, ArchivesSpace import.

### Feature Gating Add-Ons
- Library module (patrons/circulation/fines/acquisitions)
- Authority control (Getty AAT/ULAN/TGN)
- IIIF high-res serving
- OAI-PMH harvesting endpoint
- External CMS connectors
- RFID/Barcode inventory workflows

## Compliance
**Data governance and regulatory controls** (to be expanded during execution):

### GDPR & Data Privacy
- **Data Retention**: Configurable retention policies per organization.
- **Right to Erasure**: Soft-delete with audit trail; hard-delete on request.
- **Data Portability**: Export all organization data in standard formats (CSV, JSON).
- **Consent Tracking**: Audit log for all data access and modifications.

### SOC2-Style Controls
- **Access Control**: Role-based permissions with audit trail.
- **Encryption**: Data at rest (Convex) and in transit (HTTPS).
- **Audit Logging**: Immutable log of all mutations with user, timestamp, changes.
- **Change Management**: Approval workflows for sensitive operations (deaccessions, insurance claims).
- **Incident Response**: Audit log queryable for forensics.

### Compliance Reports
- **Accession/Deaccession Approvals**: Board-ready reports with signatures.
- **Loan Agreements**: Automated PDF generation + storage.
- **Insurance Coverage**: Policy expiry alerts + claims tracking.
- **Conservation Records**: Treatment history + before/after documentation.

## QA/Verification
**Quality gates and verification commands** (placeholder; to be populated during execution):

### Verification Commands
```bash
# Type safety
bun run typecheck

# Linting
bun run lint

# Tests
bun test                    # All tests
bun test:once               # Single run
bun test loans.test.ts      # Specific module
bun test -t "approve"       # Pattern match
```

### Quality Gates
- [ ] No TypeScript errors on touched files.
- [ ] Biome lint passes on touched files.
- [ ] All mutations have `args` and `returns` validators.
- [ ] All queries use `.withIndex()` for indexed fields.
- [ ] Permissions checked on all mutations/queries.
- [ ] Audit log entries generated for state changes.
- [ ] Empty/loading/error states handled in UI.
- [ ] Design reference parity verified.

### Test Coverage (by module)
- [ ] Accessions: create, approve, complete, reject.
- [ ] Deaccessions: create, approve, execute, audit trail.
- [ ] Loans: create, approve, return, condition tracking.
- [ ] Exhibitions: create, add objects, conflict checks.
- [ ] Conservation: create, update, complete, attachments.
- [ ] Locations: create, move object, occupancy tracking.
- [ ] Library: checkout, return, renew, fines accrual.
- [ ] Permissions: role-based access, object-level rules.

## Execution Scaffolding

### Dependency Map

Platform services have explicit dependencies that determine build order:

```
Audit Log (foundational)
  ↓
Permissions ← Organizations, Roles
  ↓
Notifications ← Audit Log, Workflow Engine
  ↓
Workflow Engine ← Permissions, Audit Log, Notifications
  ↓
Media & Storage ← Permissions
  ↓
Search ← All modules (indexes)
```

**Service Dependencies:**
- **Audit Log**: No dependencies (foundational service). Tracks all mutations.
- **Permissions**: Depends on Organizations, Roles. Enforces RBAC on all mutations/queries.
- **Notifications**: Depends on Audit Log (event source), Workflow Engine (assignments).
- **Workflow Engine**: Depends on Permissions (role-based approvals), Audit Log (change tracking), Notifications (assignment alerts).
- **Media & Storage**: Depends on Permissions (upload/delete rights), Convex storage.
- **Search**: Depends on all modules (full-text indexes), Permissions (filter by access).

**Module Dependencies:**
- **Objects, Collections, Locations**: Depend on Media (images), Permissions.
- **Accessions, Loans, Deaccessions**: Depend on Workflow Engine, Permissions, Audit Log.
- **Exhibitions, Conservation**: Depend on Workflow Engine, Objects, Media.
- **Library**: Depends on Workflow Engine (acquisitions), Permissions.
- **Public Portal**: Depends on Objects, Media, Exhibitions, Permissions (public visibility).

### Critical Path for 6-Month Delivery

Full product delivery requires phased execution with strict dependency ordering:

**Phase 1 (Months 1-2): Foundations**
- Audit Log (immutable change tracking)
- Permissions & Roles (RBAC enforcement)
- Notifications (in-app center)
- Workflow Engine (state machine for approvals)
- Media & Storage (Convex storage + metadata)
- **Blocking**: All subsequent modules depend on these.

**Phase 2 (Months 3-4): Core Modules**
- Objects CRUD + media + location history
- Collections/Groups + assignments
- Locations tree + occupancy tracking
- Accessions workflow (intake → approval → complete)
- Loans workflow (create → approve → return)
- Dashboard (KPIs from all data sources)
- **Blocking**: Exhibitions, Conservation, Library depend on Objects + Workflow Engine.

**Phase 3 (Months 5-6): Advanced Modules**
- Deaccessions workflow (create → approve → execute)
- Exhibitions (gallery + timeline views, conflict checks)
- Conservation (treatment workflow, before/after photos)
- Library (catalog, circulation, fines, acquisitions)
- Public Portal (searchable collection, publishing controls)
- Integrations (CSV import/export, webhooks, standards)
- Reporting & Analytics (inventory, loans, conservation)
- **Completion**: All core and advanced modules operational.

**Timeline Rationale:**
- Months 1-2 establish platform foundations (audit, permissions, workflow engine).
- Months 3-4 build core catalog and workflow modules (objects, accessions, loans).
- Months 5-6 complete advanced modules and public-facing features.
- No MVP phases; full product delivery in 6 months.

### Linear Alignment

Use Linear MCP to create and manage epics/issues aligned to this plan:

**Label Taxonomy (from Epic 0):**
- `module/*` (exactly one per issue): objects, accessions, loans, exhibitions, conservation, library, etc.
- `phase/*` (exactly one): core | advanced | operations
- Type (exactly one): Feature | Bug | Chore | Docs | Improvement
- Surface (as needed): frontend | backend | design | workflow
- Priority (optional): priority-1 | priority-2 | priority-3

**Sync Workflow:**
1. Break down each Epic into Linear issues using `mcp_linear_create_issue`.
2. Apply labels per taxonomy (module, phase, type, surface).
3. Link issues to projects (phases) for timeline tracking.
4. Use `mcp_linear_update_issue` to add blocking/related relations.
5. Reference Epic descriptions in issue bodies for context.

**Example Linear MCP Usage:**
```bash
# Create issue from Epic 8 (Accessions Workflow)
mcp_linear_create_issue \
  --title "Implement accessions intake form" \
  --team "Engineering" \
  --project "Phase 2: Core Modules" \
  --labels "module/accessions,phase/core,Feature,frontend" \
  --description "Kanban-driven intake form with document attachments..."

# Link blocking dependency
mcp_linear_update_issue \
  --id "ACC-123" \
  --blockedBy "PERM-45,AUDIT-67,WF-89"
```

**Note**: Use Linear MCP tools (`create_issue`, `update_issue`, `list_issues`) to automate epic-to-issue conversion and maintain label consistency.

### Verification Checklist

Run these commands at each phase boundary to ensure quality gates:

**Type Safety & Linting:**
```bash
bun run typecheck    # TypeScript check all workspaces
bun run lint         # Biome lint + sherif monorepo check
bun run format       # Biome format (writes files)
```

**Testing:**
```bash
bun test             # Run all tests (from packages/backend/)
bun test:once        # Single run without watch
bun test loans.test.ts  # Run specific module tests
bun test -t "approve"   # Run tests matching pattern
```

**Dependency Audit:**
```bash
bunx knip            # Find unused exports/dependencies
```

**Quality Gates (per phase):**
- [ ] No TypeScript errors on touched files.
- [ ] Biome lint passes on touched files.
- [ ] All mutations have `args` and `returns` validators.
- [ ] All queries use `.withIndex()` for indexed fields.
- [ ] Permissions checked on all mutations/queries.
- [ ] Audit log entries generated for state changes.
- [ ] Empty/loading/error states handled in UI.
- [ ] Design reference parity verified.
- [ ] Tests added for workflows, permissions, integrations.

## Execution Notes
**Critical path and sequencing** (placeholder; to be populated during execution):

### Phase 1: Foundations (Months 1-2)
- [ ] Finalize Design → Implementation matrix.
- [ ] Set up Convex schema for all modules.
- [ ] Implement audit log + activity feed.
- [ ] Set up permissions middleware.

### Phase 2: Core Catalog (Months 3-4)
- [ ] Objects CRUD + media + location history.
- [ ] Collections/Groups CRUD + assignments.
- [ ] Locations tree + occupancy.
- [ ] Digital assets browser.

### Phase 3: Workflows (Months 5-6)
- [ ] Accessions workflow (intake → approval → complete).
- [ ] Deaccessions workflow (create → approve → execute).
- [ ] Loans workflow (create → approve → return).
- [ ] Exhibitions workflow (create → add objects → approve).

### Phase 4: Advanced Modules (Months 7-8)
- [ ] Conservation workflow.
- [ ] Library circulation (checkout, return, fines).
- [ ] Transit log + shipment tracking.
- [ ] Insurance policies + claims.

### Phase 5: Operations & Reporting (Months 9-10)
- [ ] Accounts/CRM + relationship mapping.
- [ ] Reporting & analytics (inventory, loans, conservation).
- [ ] Bulk operations (move, export, deaccession).
- [ ] Feature gating (Free/Pro/Enterprise).

### Phase 6: Public Portal & Polish (Months 11-12)
- [ ] Public portal (searchable collection, publishing controls).
- [ ] Integrations (CSV import/export, webhooks, standards).
- [ ] QA, seed data, tests.
- [ ] Performance optimization + deployment.

### Critical Dependencies
- Audit log must be in place before workflows.
- Permissions middleware must be in place before mutations.
- Workflow engine must be in place before accessions/loans/deaccessions.
- Media storage must be in place before digital assets.

### Risk Mitigation
- **Scope creep**: Stick to Guardrails; defer non-core integrations to post-launch.
- **Performance**: Use `.withIndex()` for all queries; paginate large datasets.
- **Data integrity**: Enforce permissions at Convex layer; audit all mutations.
- **Testing**: Write tests for workflows, permissions, and integrations early.

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

### Label Taxonomy (Required)

* `module/*` (exactly one per issue, multi-module allowed for cross-cutting work)
* `phase/*` (exactly one): core | advanced | operations
* Type (exactly one): `Feature` | `Bug` | `Chore` | `Docs` | `Improvement`
* Surface (as needed): `frontend` | `backend` | `design` | `workflow`
* Priority (optional): `priority-1` | `priority-2` | `priority-3`

#### Canonical Rules
* Use one type label only.
* Do not use `enhancement` (use `Improvement` instead).
* Add surface labels only if they help routing work.

#### Examples
* `module/collections` + `phase/core` + `Feature` + `backend`
* `module/security` + `phase/core` + `Bug` + `backend`
* `module/accounts` + `phase/advanced` + `Improvement` + `frontend`

### Definition of Done (Template)
- UI matches design reference for touched screens.
- Data wired to Convex endpoints (no mock data).
- Permissions checked on all mutations/queries.
- Activity + audit log entries generated where relevant.
- Empty/loading/error states handled.
- Tests or coverage notes added when applicable.
- No TypeScript errors; lint passes on touched files.

#### Commands (when applicable)
* `bun run lint`
* `bun run typecheck`
* `bun test` / targeted test

## Epic 1 — App Shell, Navigation, Global UX
- Global command palette (search + create actions): quick access to create object/loan/exhibition/accession, navigate to any module.
- Unified search across objects, loans, accessions, library items, locations, accounts, exhibitions, conservation treatments.
- Global activity feed: recent changes across all modules (object moved, loan approved, conservation completed, accession received).
- Permission gating: role-based visibility of modules, actions, and data across all features.
- Reusable right inspector panel for details (object, loan, collection group, account, exhibition).
- Mobile layout parity: sidebar drawer, inspector drawer, responsive tables.

## Epic 2 — Permissions, Roles, Audit, Notifications
- Audit permissions coverage on all routes + mutations.
- Role management UI (create/edit roles, assign permissions).
- Notifications center (read/unread, links to workflow items).
- Audit log filters: user, entity type, time range.

## Epic 3 — Dashboard / Overview (HTML Parity)
- Dashboard KPIs from `api.dashboard.getAnalytics` (verify semantics).
- "Departments & Collections" grid as real collection groups.
- Recent activity log unifies accessions, deaccessions, loans, objects, exhibitions, conservation treatments.
- CTA buttons (Add Object, New Exhibition) wired to flows.
- **Interoperability**: Link to Objects (catalog), Loans (active/overdue), Exhibitions (upcoming), Conservation (in-progress), Accessions (pending approval).

## Epic 4 — Collection Groups (Departments)
- Collection Group CRUD (name, description, image, curator).
- Assign/unassign objects to groups (bulk + object detail).
- Group detail page KPIs and activity.
- Group-level access control (optional).
- **Interoperability**: Link to Objects (assigned to group), Exhibitions (featuring group objects), Conservation (treatments on group objects), Loans (outgoing from group).

## Epic 5 — Object Catalog (List/Grid, Filters, Bulk Ops)
- List/grid toggle parity with saved views.
- Filters: group, status, location, period, culture, material, date acquired.
- Bulk actions: move, add to exhibition/loan, export, deaccession.
- Column customization per user.
- **Interoperability**: Link to Loans (object on loan), Exhibitions (object displayed), Conservation (treatment history), Location (current/historical), Accessions (acquisition record).

## Epic 6 — Object Record Detail
- Tab parity: details, media, conservation, exhibitions, loans, location history.
- Provenance editor + ownership history.
- Public visibility controls and high-res download flags.
- Print/export object record sheet (PDF).
- **Interoperability**: Tabs link to active Loans, Exhibitions, Conservation treatments, Location history, Accession record, Insurance policies, Media assets.

## Epic 7 — Digital Assets (Per-Object + Global)
- Global assets browser (filter by type, uploader, date, linked object).
- Upload UX: drag/drop, progress, validation, retries.
- Media metadata editing + primary image handling.
- Storage usage analytics by type and per object.
- **Interoperability**: Link media to Objects (primary/secondary images), Conservation (before/after photos), Accessions (intake photos), Exhibitions (installation photos), Accounts (profile images).

## Epic 8 — Accessions Workflow
- Kanban steps driven by `workflowConfigs`.
- Intake form, document attachments, donor/source linkage.
- Batch import workflow (CSV) + error reporting.
- Assignment support (tie to "My Assignments").
- **Interoperability**: Link to Objects (created from accession), Accounts (donor/source), Documents (intake forms, agreements), Tasks (workflow steps), Media (intake photos), Workflow (approval chain), Audit (all changes logged).

## Epic 9 — Deaccessions Workflow
- Deaccession creation: reason, method, proceeds, approvals.
- Enforce object status transitions + audit log entries.
- Exports for board/collections committee.
- **Interoperability**: Link to Objects (removed), Accounts (disposal recipient), Workflow (approval chain), Audit (all changes logged), Documents (deaccession records).

## Epic 10 — Locations & Movement
- Locations tree UI + detail panel (gallery vs storage modes).
- Move object flow with reason + history.
- Capacity/occupancy tracking for rooms/cabinets/drawers.
- Environmental data fields (manual entry first).
- **Interoperability**: Link to Objects (current location, movement history), Loans (transit locations), Exhibitions (display locations), Accounts (responsible parties).

## Epic 11 — Loans & Transport (Core)
- Loans list: incoming/outgoing tabs, filters, search.
- Loan detail: condition in/out, documents, approvals, timeline.
- Loan agreement generator + PDF storage.
- Enforce object state and location transitions.
- **Interoperability**: Link to Objects (loaned items), Accounts (borrower/lender), Documents (agreements, insurance), Transit (shipment tracking), Insurance (coverage), Workflow (approval chain), Audit (all changes).

## Epic 12 — Transit Log (New Module)
- Create transit records (route, carrier, tracking, ETA, status).
- Link shipments to loans/exhibitions/objects.
- Status changes + notifications.
- **Interoperability**: Link to Loans (shipment for loan), Exhibitions (shipment for exhibition), Objects (items in transit), Accounts (carriers, recipients), Documents (shipping labels, insurance).

## Epic 13 — Exhibitions Management
- Gallery vs timeline views (HTML parity).
- Exhibition detail: KPIs, included objects, approvals.
- Conflict checks with loans/other exhibitions.
- Attachments + object selection workflows.
- **Interoperability**: Link to Objects (displayed items), Locations (display locations), Conservation (pre-exhibition checks), Loans (conflict detection), Accounts (partners, sponsors), Tasks (installation planning), Documents (contracts), Media (installation photos).

## Epic 14 — Installation Planning (New Module)
- Task board by exhibition (todo/in-progress/done).
- Task templates: lighting, signage, mounts, conservation checks.
- Assignments + due dates + dependencies.
- **Interoperability**: Link to Exhibitions (parent exhibition), Tasks (workflow steps), Accounts (assigned staff), Documents (specifications, checklists), Media (reference photos).

## Epic 15 — Conservation & Care
- Treatment workflow (propose → approve → in progress → complete).
- Attachments: before/after photos, reports.
- Alerts for critical attention.
- **Interoperability**: Link to Objects (treated items), Accounts (conservators), Documents (treatment reports), Media (before/after photos), Tasks (treatment steps), Workflow (approval chain), Audit (all changes logged).

## Epic 16 — Insurance & Audit (New Module)
- Insurance policies CRUD (carrier, coverage, premium schedule).
- Link policies to objects/exhibitions/loans.
- Expiry and missing-coverage alerts.
- Claims tracking + documents.
- **Interoperability**: Link to Objects (insured items), Loans (coverage during transit), Exhibitions (event coverage), Accounts (insurers, claimants), Documents (policies, claims), Audit (all changes logged).

## Epic 17 — Library & Research
- Library catalog polish: full CRUD + ISBN auto-fill.
- Patron management polish: membership, limits, statuses.
- Circulation desk: checkout, return, renew, holds.
- Fines: accrual, payments, waivers, receipts.
- Acquisitions workflow: request → approval → ordered → received.
- **Interoperability**: Link to Accounts (patrons, vendors), Documents (acquisition requests, receipts), Tasks (workflow steps), Workflow (approval chain), Audit (all changes logged).

## Epic 18 — Public Portal / Publishing (New Module)
- Public site routes (apps/web) for searchable collection.
- Publishing settings: public URL slug, public search toggle, high-res toggle.
- Public object page with redaction rules.
- SEO, sitemap, per-org branding.
- **Interoperability**: Link to Objects (published items), Media (high-res images), Exhibitions (public display), Accounts (organization info).

## Epic 19 — Data Import/Export & Integrations
- CSV import/export for objects, accessions, locations, accounts.
- Media bulk import jobs.
- Webhooks + API keys UI.

## Epic 20 — Subscription Tiers & Feature Gating
- Define tier entitlements (Free/Pro/Enterprise) for core platform modules.
- Integration access is handled via **per‑integration subscriptions** (add-ons), not tier bundling.
- Frontend + backend feature gate utility (Convex + UI guardrails).
- Use `enabledModules` and `enabledIntegrations` to toggle optional modules and add-ons.
- Upgrade prompts and "locked feature" UX in settings/nav.
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

## Shared Services — Shared Entities

### People/Organizations
- **Definition**: Reusable entity for individuals and institutions across the platform.
- **Used by**: Loans (borrowers/lenders), Exhibitions (partners/sponsors), Accessions (donors/sources), Library (patrons), Conservation (conservators), Accounts (CRM contacts).
- **Fields**: Name, type (person/organization), contact info (email, phone, address), tax ID, notes, linked documents.
- **Audit**: All changes tracked; linked to activity feed.

### Documents
- **Definition**: Attachments and records linked to entities across modules.
- **Used by**: Loans (agreements, insurance), Exhibitions (contracts), Accessions (intake forms), Conservation (treatment reports), Insurance (policies, claims), Library (acquisition requests).
- **Fields**: Title, type (agreement/report/form/policy), file URL, upload date, linked entity, version.
- **Audit**: Upload/delete tracked; access logged.

### Tasks
- **Definition**: Workflow steps and assignments across modules.
- **Used by**: Exhibitions (installation planning), Conservation (treatment steps), Accessions (workflow steps), Library (acquisitions workflow).
- **Fields**: Title, status (todo/in-progress/done), assignee, due date, dependencies, linked entity.
- **Audit**: Status changes tracked; assignment changes logged.

### Locations
- **Definition**: Physical spaces where objects are stored, displayed, or in transit.
- **Used by**: Objects (current location), Exhibitions (display locations), Loans (transit locations), Conservation (treatment location).
- **Fields**: Name, type (gallery/storage/transit), capacity, occupancy, environmental data, parent location (tree structure).
- **Audit**: Occupancy changes tracked; movement history maintained.

### Media
- **Definition**: Digital assets (images, videos, documents) linked to entities.
- **Used by**: Objects (primary/secondary images), Conservation (before/after photos), Accessions (intake photos), Exhibitions (installation photos), Accounts (profile images).
- **Fields**: File URL, type (image/video/document), upload date, uploader, linked entity, metadata (dimensions, file size).
- **Audit**: Upload/delete tracked; access logged.

### Workflow
- **Definition**: Approval chains and state transitions across modules.
- **Used by**: Accessions, Deaccessions, Loans, Conservation, Exhibitions, Library acquisitions.
- **Fields**: Name, steps (array of status values), approvers per step, SLA timers, escalation rules.
- **Audit**: Approval history tracked; rejections logged with reason.

### Audit
- **Definition**: Immutable log of all changes across the platform.
- **Used by**: All modules for compliance, debugging, and activity feeds.
- **Fields**: Timestamp, user, action (create/update/delete), entity type, entity ID, changes (before/after), IP address, result (success/failure).
- **Retention**: 7 years minimum; immutable; searchable by user, entity type, action, date range.

---

## Epic 23 — Accounts & Institution CRM
- Account detail page with contacts, notes, documents, activity timeline.
- Relationship mapping between institutions and loans/exhibitions.
- Patron segmentation and bulk communications.
- **Interoperability**: Link to Loans (borrower/lender), Exhibitions (partners/sponsors), Accessions (donors), Library (patrons), Conservation (conservators), Media (profile images), Documents (contracts, agreements).

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
