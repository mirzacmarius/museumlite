---
name: Linear Issue
about: Standard issue template following MUS-263 taxonomy
title: ''
labels: ''
assignees: ''
---

## Description
<!-- Describe the issue or feature -->

## Labels Required (see [APP-IDEEA.md](../../docs/APP-IDEEA.md#label-taxonomy-required))
- [ ] `module/*` - exactly one (multi-module allowed for cross-cutting work)
- [ ] `phase/*` - exactly one: core | advanced | operations
- [ ] Type - exactly one: Feature | Bug | Chore | Docs | Improvement
- [ ] Surface (optional): frontend | backend | design | workflow
- [ ] Priority (optional): priority-1 | priority-2 | priority-3

> Do not use `enhancement` - use `Improvement` instead.

## Acceptance Criteria
<!-- List specific acceptance criteria -->
- [ ] ...

## Definition of Done
- [ ] UI matches design reference for touched screens
- [ ] Data wired to Convex endpoints (no mock data)
- [ ] Permissions checked on all mutations/queries
- [ ] Activity + audit log entries generated where relevant
- [ ] Empty/loading/error states handled
- [ ] Tests or coverage notes added when applicable
- [ ] No TypeScript errors; lint passes on touched files
