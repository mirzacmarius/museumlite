## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff manage clearly defined primary and secondary collection memberships without contradictory associations.

Batch 3; recommendations R16. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Agree primary-role semantics and maintain one authoritative membership relation with protected references.
- [ ] Group selection, object editing, counts, transfers and supported import/export paths use the canonical relation.
- [ ] Backfill additively and retire duplicated semantics only after reader/writer parity; retain original evidence of ambiguous memberships.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-613](https://linear.app/museumlite/issue/MUS-613/validate-related-records-and-retain-bulk-movement-evidence)
