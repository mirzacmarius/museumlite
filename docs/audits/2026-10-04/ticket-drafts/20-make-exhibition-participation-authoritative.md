## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

An exhibition has one complete many-object participant list instead of competing anchor and member records.

Batch 3; recommendations R16. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Expand canonical participation and migrate all affected exhibition readers/writers with compatible historical records.
- [ ] Many-object creation, member roles/order, filters and counts work with scoped permissions.
- [ ] Retire competing writer/field semantics only after parity and legacy-member review are proven.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-613](https://linear.app/museumlite/issue/MUS-613/validate-related-records-and-retain-bulk-movement-evidence)
