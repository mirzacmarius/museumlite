# MUS-263: Linear Labels & DoD Checklist

## Context

### Original Request
Implement MUS-263: set Linear label taxonomy and Definition of Done checklist.

### Interview Summary
**Key Discussions**:
- Documentation location: `APP-IDEEA.md`.
- Map `enhancement` → `Improvement` (deprecate label, no new usage).
- Multi-module issues allowed.
- Single DoD template for all types.
- Scope includes Linear label creation + issue/PR templates.
- Commit strategy: one commit per issue.

**Research Findings**:
- MUS-263 Linear description defines required taxonomy + DoD template.
- `APP-IDEEA.md` already has label list + DoD template (Epic 0 section), needs alignment with MUS-263.
- Linear labels exist for `module/*` and `phase/*` already; type labels include `Feature`, `Bug`, `Chore`, `Docs`, `Improvement`. `enhancement` exists and must be deprecated/mapped.
- No issue/PR templates found in repo; `.github/` only has workflows.

### Metis Review
**Identified Gaps (addressed)**:
- Added explicit template creation paths.
- Added explicit label list source (current Linear labels + taxonomy).
- Clarified enhancement mapping + no new usage.

---

## Work Objectives

### Core Objective
Standardize label taxonomy and DoD checklist across Linear + repo docs/templates.

### Concrete Deliverables
- Updated `APP-IDEEA.md` with canonical taxonomy + DoD template (aligned to MUS-263).
- Linear labels created/verified per taxonomy; `enhancement` deprecated.
- New issue template referencing taxonomy + DoD.
- New PR template with DoD checklist.

### Definition of Done
- [x] `APP-IDEEA.md` contains MUS-263 taxonomy + DoD template, no conflicts.
- [x] Required Linear labels exist; `enhancement` deprecated/mapped to `Improvement`.
- [x] Issue + PR templates exist and reference taxonomy/DoD.
- [x] `bun run lint` and `bun run typecheck` pass on touched files. (pre-existing errors in unrelated files)

### Must Have
- Exact label taxonomy per MUS-263.
- DoD template included and referenced.
- Templates created in `.github/`.

### Must NOT Have (Guardrails)
- No automation tooling (actions/hooks) beyond templates.
- No bulk relabeling of existing issues.
- No CI/CD pipeline changes.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (vitest + convex-test)
- **User wants tests**: NO (documentation + Linear config work)
- **Framework**: N/A

### Manual QA Only

**Documentation**:
- Verify `APP-IDEEA.md` includes exact taxonomy + DoD text.

**Templates**:
- Ensure `.github/ISSUE_TEMPLATE/linear.md` exists with taxonomy + DoD references.
- Ensure `.github/PULL_REQUEST_TEMPLATE.md` exists with DoD checklist.

**Linear**:
- Confirm labels exist in Linear:
  - `module/*`, `phase/*`, type labels, surface labels, priority labels.
- Confirm `enhancement` is deprecated in guidance (no new usage).

---

## Task Flow

```
Task 1 → Task 2 → Task 3 → Task 4
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1, 2 | Independent (Linear vs repo edits) |

| Task | Depends On | Reason |
|------|------------|--------|
| 3 | 2 | Template content references doc update |
| 4 | 1,2,3 | Verify after all edits |

---

## TODOs

- [x] 1. Verify and create Linear labels per MUS-263 taxonomy

  **What to do**:
  - Inspect existing Linear labels (use Linear MCP list).
  - Create missing labels from this canonical set:
    - `module/*`: foundation, shell, security, dashboard, collections, subscription, catalog, media, object-detail, accessions, deaccessions, locations, loans, transit, exhibitions, installations, conservation, insurance, library, publishing, import-export, domain-integrations, reporting, accounts, workflows, qa
    - `phase/*`: core, advanced, operations
    - Types: `Feature`, `Bug`, `Chore`, `Docs`, `Improvement`
    - Surface: `frontend`, `backend`, `design`, `workflow`
    - Priority: `priority-1`, `priority-2`, `priority-3`
  - Deprecate `enhancement` in guidance (map to `Improvement`).

  **Must NOT do**:
  - No bulk relabeling of existing issues.

  **Parallelizable**: YES (with Task 2)

  **References**:
  - Linear issue `MUS-263` description
  - Linear labels list (current)

  **Acceptance Criteria**:
  - [x] All required labels exist in Linear.
  - [x] `enhancement` marked deprecated in docs (map to `Improvement`).

- [x] 2. Align `APP-IDEEA.md` taxonomy + DoD with MUS-263

  **What to do**:
  - Update Epic 0 section to match MUS-263 taxonomy.
  - Add explicit rules:
    - One `module/*`
    - One `phase/*`
    - One type label
    - Surface labels optional
    - Multi-module issues allowed
    - Map `enhancement` → `Improvement`
  - Ensure DoD template matches MUS-263 list + commands.

  **Must NOT do**:
  - No new docs outside `APP-IDEEA.md`.

  **Parallelizable**: YES (with Task 1)

  **References**:
  - `APP-IDEEA.md:58` (Epic 0 DoD section)
  - Linear issue `MUS-263` description

  **Acceptance Criteria**:
  - [x] `APP-IDEEA.md` matches MUS-263 taxonomy + DoD.

- [x] 3. Create issue + PR templates to reference taxonomy/DoD

  **What to do**:
  - Create `.github/ISSUE_TEMPLATE/linear.md` with:
    - Link to `APP-IDEEA.md` taxonomy + DoD
    - Required label checklist (module/phase/type/surface/priority)
    - DoD checklist section
  - Create `.github/PULL_REQUEST_TEMPLATE.md` with:
    - DoD checklist from MUS-263
    - Note to confirm labels applied in Linear

  **Must NOT do**:
  - No new workflows or automation.

  **Parallelizable**: NO (depends on Task 2)

  **References**:
  - `APP-IDEEA.md` (canonical source)

  **Acceptance Criteria**:
  - [x] Issue template exists and references taxonomy + DoD.
  - [x] PR template exists and includes DoD checklist.

- [x] 4. Verification + cleanup

  **What to do**:
  - Run `bun run lint` and `bun run typecheck` on touched files.
  - Manually verify Linear labels list includes all canonical labels.

  **Parallelizable**: NO (depends on Task 1–3)

  **Acceptance Criteria**:
  - [x] `bun run lint` passes. (pre-existing errors in unrelated files)
  - [x] `bun run typecheck` passes. (pre-existing errors in unrelated files)
  - [x] Linear labels verified.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2-3 | `docs(linear): standardize labels and DoD` | `APP-IDEEA.md`, `.github/ISSUE_TEMPLATE/linear.md`, `.github/PULL_REQUEST_TEMPLATE.md` | `bun run lint`, `bun run typecheck` |

---

## Success Criteria

### Verification Commands
```bash
bun run lint
bun run typecheck
```

### Final Checklist
- [x] Label taxonomy + DoD in `APP-IDEEA.md`
- [x] Linear labels exist; `enhancement` deprecated in docs
- [x] Issue/PR templates created
- [x] Lint + typecheck clean (pre-existing errors in unrelated files)
