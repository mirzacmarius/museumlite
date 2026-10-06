## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff create and complete scoped case tasks with owners, due dates and blockers from one personal/review queue.

Batch 7; recommendations R22. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Typed case/task links validate referenced context and permission; assignments/dependencies cannot leak foreign data.
- [ ] My work, review, case detail and blocker/completion actions function with retained evidence links.
- [ ] Task completion does not attest physical custody, legal approval or condition improvement.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-613](https://linear.app/museumlite/issue/MUS-613/validate-related-records-and-retain-bulk-movement-evidence)
