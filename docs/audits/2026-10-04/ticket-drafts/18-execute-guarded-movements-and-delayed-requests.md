## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Direct and approval-based internal moves record observed custody/location and refuse stale-source or occupancy conflicts.

Batch 3; recommendations R10. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] One guarded command records actor, observed source, destination, time, reason and case alongside current projection.
- [ ] Delayed requests revalidate source, destination access and current loan/custody occupancy at execution.
- [ ] Request/approve/execute/conflict UI works with permanent retained history; ordinary/bulk movement behavior remains consistent.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-613](https://linear.app/museumlite/issue/MUS-613/validate-related-records-and-retain-bulk-movement-evidence)
- [MUS-616](https://linear.app/museumlite/issue/MUS-616/protect-permanent-evidence-from-every-cleanup-path)
