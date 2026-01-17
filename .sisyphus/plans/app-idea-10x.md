# App Idea 10x Plan (MuseumLite)

## Context

### Original Request
Improve `APP-IDEEA.md` 10x in functionality, features, integrations; full product in 6 months; no MVP framing; EU+US compliance; OMO-ready planning output.

### Interview Summary
**Key Discussions**:
- Full product scope, no MVP cutline; build until complete within 6 months.
- Integrations chosen by cross-module interoperability.
- Compliance: GDPR + SOC2-style controls for EU+US.
- Guardrails: no new stacks, no external SaaS, no auth changes.
- Output: plan files aligned with OMO workflow; update `APP-IDEEA.md`.

**Research Findings**:
- Metis invocation blocked (Unauthorized). Prior Metis guidance used: add dependency map, design parity checklist, data/API gap mapping, shared services, explicit guardrails, acceptance criteria, and verification.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Dependency mapping across workflow/search/media/permissions.
- Design reference parity checklist per module.
- Data model/API gaps + indexes.
- Shared platform services (search, audit, notifications, files).
- Clear guardrails and acceptance criteria.

---

## Work Objectives

### Core Objective
Transform `APP-IDEEA.md` into a 10x, execution-ready product plan with deep functionality, interoperable integrations, compliance requirements, and OMO-friendly structure.

### Concrete Deliverables
- Updated `APP-IDEEA.md` with new structure: scope, dependencies, platform services, data model/API map, integrations, compliance, QA gates, and execution workflow.
- Expanded cross-module functionality and interoperability features.
- Integration portfolio prioritized by standards/protocols (non-SaaS).
- Explicit compliance and security controls (GDPR + SOC2-style).
- Linear alignment notes for epics/labels (MCP usage guidance).

### Definition of Done
- `APP-IDEEA.md` reflects full product scope with no MVP framing.
- Each module has expanded functional depth + interoperability notes.
- Shared services and dependency map included.
- Integrations list prioritizes standards-based interoperability and internal connectors.
- Compliance section includes GDPR + SOC2-style controls.
- Guardrails and acceptance criteria are explicit.

### Must Have
- Full-scope plan; no MVP language.
- 6-month delivery framing with sequencing/critical path.
- GDPR + SOC2-style controls.
- Interoperability-driven integrations.
- OMO-ready structure for execution planning.

### Must NOT Have (Guardrails)
- No new stacks (stay on Next.js/Convex/Bun/Tailwind/etc.).
- No external SaaS dependencies.
- No auth provider changes.

---

## Verification Strategy (Manual QA Only)

### Test Decision
- **Infrastructure exists**: N/A (doc-only change)
- **User wants tests**: Manual-only
- **Framework**: none

**Manual Verification**
- Open `APP-IDEEA.md` and confirm each new section exists.
- Verify explicit guardrails and compliance controls are included.
- Verify integrations list contains only standards/protocols or self-hostable components.

---

## Task Flow

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 3 | Independent content expansion areas |
| B | 4, 5 | Integration and compliance can be drafted in parallel |

| Task | Depends On | Reason |
|------|------------|--------|
| 6 | 1–5 | Consolidation needs all sections complete |

---

## TODOs

- [x] 1. Audit current `APP-IDEEA.md` and map gaps vs 10x scope

  **What to do**:
  - Inventory current sections, missing design refs, and thin areas per module.
  - Extract existing TODOs and ensure they remain represented.

  **Must NOT do**:
  - Remove existing module scope.

  **Parallelizable**: NO (base for later tasks)

  **References**:
  - `APP-IDEEA.md` - Baseline scope and epics to expand.
  - `ACCESSION_NUMBER_FORMAT_IMPLEMENTATION.md` - Existing TODO that must remain in scope.
  - `SEED_DATA_SUMMARY.md` - Seed data obligations to preserve.

  **Acceptance Criteria**:
  - [x] Gap list created in notes (kept within `APP-IDEEA.md` updates).
  - [x] Existing TODOs remain present or are migrated into new structure.

  **Manual Execution Verification**:
  - [x] Read `APP-IDEEA.md` and confirm all prior TODOs remain.

- [x] 2. Restructure `APP-IDEEA.md` into OMO-ready plan format

  **What to do**:
  - Add sections: Scope (full product), Dependencies, Shared Services, Data/API Map, Integrations, Compliance, QA/Verification, Execution Notes.
  - Ensure no MVP framing; use "full product in 6 months" language.

  **Must NOT do**:
  - Introduce new stack or external SaaS references.

  **Parallelizable**: YES (with 3)

  **References**:
  - `APP-IDEEA.md` - Current structure to be replaced/expanded.
  - `AGENTS.md` - Stack constraints and architectural rules.
  - `README.md` - Project stack summary for alignment.

  **Acceptance Criteria**:
  - [x] New sections present and logically ordered.
  - [x] No "MVP" language present.
  - [x] Guardrails explicitly listed.

  **Manual Execution Verification**:
  - [x] Confirm new headings exist in `APP-IDEEA.md`.
  - [x] Search for "MVP" shows none.

- [x] 3. Expand functional depth + interoperability per module

  **What to do**:
  - For each module, add cross-module links (objects ↔ loans ↔ exhibitions ↔ conservation ↔ library ↔ accounts).
  - Add shared entity definitions: People/Organizations, Documents, Tasks, Locations, Media, Workflow, Audit.
  - Add global UX features: command palette, unified search, global activity feed, permission gating.

  **Must NOT do**:
  - Add features that require external SaaS.

  **Parallelizable**: YES (with 2)

  **References**:
  - `APP-IDEEA.md` - Module list and current epics.
  - `packages/ui/DESIGN_TOKENS.md` - UI consistency expectations for new UX features.

  **Acceptance Criteria**:
  - [x] Each module has added interoperability bullets.
  - [x] Shared entities listed once and referenced by modules.

  **Manual Execution Verification**:
  - [x] Review module sections for interoperability notes.

- [x] 4. Define integrations portfolio (standards + self-hosted)

  **What to do**:
  - Expand integrations to emphasize interoperability: LIDO, CDWA, Dublin Core, MARC21, IIIF, OAI-PMH, CSV/JSON APIs, webhooks, SSO via existing auth.
  - Include import/export workflows tied to objects/loans/exhibitions/library.
  - Add data sync patterns (scheduled jobs, delta imports, mapping tables).

  **Must NOT do**:
  - Add vendor SaaS dependencies.
  - Change auth provider.

  **Parallelizable**: YES (with 5)

  **References**:
  - `APP-IDEEA.md` - Existing integrations sections (Epics 19–21).

  **Acceptance Criteria**:
  - [x] Integrations list expanded with standards and self-hostable protocols.
  - [x] Each integration references at least one module impact.

  **Manual Execution Verification**:
  - [x] Check integrations section for standards/protocol list and module ties.

- [x] 5. Add compliance + security controls (GDPR + SOC2-style)

  **What to do**:
  - Add compliance section with: data residency, DSR (export/delete), consent, retention, audit logs, access reviews, encryption at rest/in transit, incident response.
  - Add privacy-by-design requirements per module (PII handling in Accounts/Library/Users).

  **Must NOT do**:
  - Require external compliance vendors.

  **Parallelizable**: YES (with 4)

  **References**:
  - `APP-IDEEA.md` - To embed compliance into DoD and per-module notes.

  **Acceptance Criteria**:
  - [x] Compliance section exists with GDPR + SOC2-style controls.
  - [x] PII handling guidance added to relevant modules.

  **Manual Execution Verification**:
  - [x] Read compliance section and confirm control list.

- [x] 6. Add execution scaffolding: dependencies, critical path, Linear alignment

  **What to do**:
  - Add dependency map (workflow engine, media, search, permissions, audit) and critical path notes for 6-month delivery.
  - Add Linear alignment section: label taxonomy usage + note to sync epics via Linear MCP.
  - Add verification checklist aligned to project commands (lint/typecheck/test where applicable).

  **Must NOT do**:
  - Introduce MVP phases; keep "full product in 6 months."

  **Parallelizable**: NO (depends on 1–5)

  **References**:
  - `APP-IDEEA.md` - Epic list for dependency mapping.
  - `AGENTS.md` - Command list for verification.
  - `.github/ISSUE_TEMPLATE/linear.md` - Linear conventions (if referenced).

  **Acceptance Criteria**:
  - [x] Dependency map present.
  - [x] Linear MCP sync guidance included.
  - [x] Verification commands listed.

  **Manual Execution Verification**:
  - [x] Confirm dependency map and Linear section in `APP-IDEEA.md`.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 6 | `docs(app-idea): 10x product plan` | `APP-IDEEA.md` | Visual review only |

---

## Success Criteria

### Verification Commands
```bash
# Manual only: open file and verify sections
```

### Final Checklist
- [x] Full-scope plan with no MVP language
- [x] Integrations expanded with standards and interoperability
- [x] Compliance controls added (GDPR + SOC2-style)
- [x] Guardrails clearly stated
- [x] Dependency map + Linear alignment included
