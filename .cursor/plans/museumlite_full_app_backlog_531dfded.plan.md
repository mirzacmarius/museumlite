---
name: Museumlite_Full_App_Backlog
overview: Complete-coverage plan to finish every Museumlite page/module with design→implement→QA flow.
todos:
  - id: p0-collections-edit
    content: Implement Collections edit page + delete
    status: pending
  - id: p0-patrons-edit
    content: Implement Patrons edit page
    status: pending
  - id: p0-loans-workflow
    content: Audit/fix loans workflow pages
    status: pending
  - id: p0-delete-objects-collections
    content: Add delete flows for objects/collections
    status: pending
  - id: p1-collection-groups
    content: CRUD UI for collection groups
    status: pending
  - id: p1-accounts-crm
    content: CRUD UI for accounts/CRM
    status: pending
  - id: p1-exhibitions
    content: CRUD/schedule UI for exhibitions
    status: pending
  - id: p1-conservation
    content: CRUD/treatments UI for conservation
    status: pending
  - id: p2-workflow-config
    content: Workflow configuration UI
    status: pending
  - id: p2-notifications
    content: Notifications center UI
    status: pending
  - id: p2-integrations
    content: Webhooks/API keys management UI
    status: pending
  - id: p3-import-tools
    content: Import jobs wizard UI
    status: pending
  - id: p3-export-tools
    content: CSV/export/report tools per list
    status: pending
  - id: p3-bulk-actions
    content: Bulk actions across lists
    status: pending
  - id: p3-reporting-analytics
    content: Reporting/analytics standard + custom builder
    status: pending
  - id: p3-search-discovery
    content: Global search with facets/saved searches
    status: pending
  - id: p3-audit-permissions
    content: Audit logs and role/permission hardening
    status: pending
  - id: p3-offline-performance
    content: Offline/performance (virtualize, background sync)
    status: pending
  - id: p4-media-gallery
    content: Media gallery PDF/3D/docs enhancements
    status: pending
  - id: p4-keyboard-shortcuts
    content: Keyboard shortcuts for core flows
    status: pending
  - id: p4-global-search
    content: Global search across modules
    status: pending
  - id: p4-dashboard-calendar
    content: Dashboard widgets + calendar views
    status: pending
  - id: p5-shipping
    content: Shipping/logistics module
    status: pending
  - id: p5-inventory
    content: Inventory/audit workflows
    status: pending
  - id: p5-environmental-condition
    content: Environmental + condition tracking with alerts
    status: pending
  - id: p5-logistics-insurance
    content: Logistics/insurance (packing, courier, indemnity)
    status: pending
  - id: p5-circulation-policies
    content: Library circulation policies/holds/serials
    status: pending
  - id: p5-rights-compliance
    content: Rights, PII, GDPR, consent, backups
    status: pending
  - id: p5-role-access-matrix
    content: Roles (registrar/curator/conservator/librarian/preparator/loans/admin/guest) with per-module permissions, approvals, notifications
    status: pending
  - id: p5-public-portal
    content: Public portal for collections
    status: pending
  - id: p5-reports-builder
    content: Reports builder module
    status: pending
  - id: qa-lint-docs
    content: QA, lint, docs, Linear updates
    status: pending
---

# Museumlite Complete Application Plan

## Scope

Deliver full coverage for all existing tables and UX gaps: every list/detail/new/edit page, workflows, bulk ops, imports/exports, search, notifications, dashboards, and future modules.

## Phase 0: Linear & Branching

- Create new Linear project; add labels `design,frontend,backend,workflow,infra,bug`.
- Milestones: `P0 Fixes`, `P1 Core Modules`, `P2 Workflows/Config`, `P3 Tools/Bulk`, `P4 UX`, `P5 Future`.
- Branch per feature: `feature/[module]-[slug]`; commits `feat([module]): ...`; Bun for scripts/lint.

## Phase 1: P0 Fixes (Existing Gaps)

- Collections edit page at `.../collections/[id]/edit`.
- Patrons edit page at `.../library/patrons/[id]/edit`.
- Loans workflow audit/fix in `.../loans/[id]` + edit.
- Delete actions for Objects and Collections.
- Find the other missing parts.

## Phase 2: P1 Core Modules (missing UIs for existing tables)

- Collection Groups: list/detail/new/edit (`/collection-groups`).
- Accounts/CRM: list/detail/new/edit (`/accounts`).
- Exhibitions: list/detail/new/edit/schedule (`/exhibitions`).
- Conservation: list/detail/new/edit/treatments (`/conservation`).

## Phase 3: P2 Workflows & Config

- Workflow Configuration UI for `workflowConfigs` (builder, steps per type).
- Notifications center (bell + panel/page) for `notifications`.
- Webhooks/API keys management page.

## Phase 4: P3 Tools & Bulk Ops

- Import jobs UI (CSV/media wizard, progress) for `importJobs`.
- Export tools (CSV, collection export, reports) per list.
- Bulk actions (multi-select, bulk status/move/delete/export) across lists.
- Reporting/Analytics: standard reports (loans due/overdue, location moves, treatments pipeline, acquisitions vs budget, circulation stats) plus custom builder and scheduled email delivery.
- Global Search & Discovery: faceted search across modules, saved searches, export from results.
- Audit & Permissions: immutable audit log (who/what/when/where), role-based permission hardening per museum roles (registrar, curator, conservator, librarian, preparator, loans, admin, guest), quiet-hour notification preferences.
- Offline/Performance: list virtualization for large sets, background sync for imports, offline capture option for inventory rounds (if feasible).

## Phase 5: P4 UX & Feature Enhancements

- Media gallery: PDF preview, 3D viewer, documents section.
- Keyboard shortcuts coverage for core flows.
- Global search across modules.
- Dashboard widgets refresh + calendar views (loans due, exhibitions schedule).

## Phase 6: P5 Future Modules

- Shipping/Logistics (crating/transport).
- Inventory/Audit workflows.
- Public portal (read-only collection site).
- Reports builder module.
- Environmental & Condition Tracking: condition templates, treatment history with media, environmental requirements (temp/RH/light) and alerts, location moves with chain of custody.
- Logistics & Insurance: packing/crating instructions, courier data, insurance values/certificates, facility reports, indemnity tracking, install/deinstall checklists.
- Library Circulation Policies: patron blocks/fines policies, holds/renewals rules, notices templates, acquisitions pipeline, vendor records, serials check-in.
- Rights/PII/Compliance: rights/restrictions per asset, consent notes, GDPR export/delete, backups/restore points, disaster-recovery playbook.
- Roles & Access: role matrix (registrar/curator/conservator/librarian/preparator/loans/admin/guest), per-module CRUD/workflow scopes, approval authorities, notification preferences, and permission checks in backend/front-end guards.

## Execution Loop per Task

- Design (aura.build) if no approved UI → share link → await approval.
- Droid prompt with Linear ID, design link, target paths, backend/schema notes, QA checklist.
- Implement frontend in `apps/app/src/app/[locale]/(dashboard)/...`; backend in `packages/backend/convex/...`; schema in `packages/backend/convex/schema.ts` if needed.
- QA: render, CRUD/workflow states, toasts/errors, lint via `bun lint`.
- Update Linear with links (design/PR), status, and test notes.

## Acceptance Criteria

- Every table has list/detail/new/edit coverage and workflows operable.
- Bulk ops + import/export available where applicable.
- Reporting: standard reports shipped; custom report builder works; scheduled delivery functions.
- Search: global faceted search with saved searches; exports from results.
- Notifications: inbox/panel with preferences; time- and event-based alerts.
- Audit & Permissions: immutable audit log; role-based access aligned to museum roles.
- Environmental/Condition: requirements stored; alerts on threshold breaches; chain-of-custody for moves.
- Logistics/Insurance: packing/insurance data captured; install/deinstall checklists; courier/tracking recorded.
- Library Circulation: holds/renewals, fines/blocks policies, acquisitions → receive → catalog, vendor + serials tracking.
- Rights/Compliance: rights metadata, consent/PII handling, GDPR export/delete, backups/restore tested.
- Offline/Performance: lists virtualized; background sync for imports; offline inventory capture if included.
- No lint errors; docs updated for new modules; Linear reflects completion.