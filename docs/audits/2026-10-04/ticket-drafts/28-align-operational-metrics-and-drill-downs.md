## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Dashboard, listing and report metrics use one defined lifecycle/schedule meaning and matching drill-down filters.

Batch 4; recommendations R15. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Agree active/current/upcoming/past and inventory/loan exclusions with explicit as-of time.
- [ ] Review legacy flags and contradictory counters rather than silently inventing states.
- [ ] Overview, analytics and list links show consistent definitions/count scope, including missing versus zero values.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-630](https://linear.app/museumlite/issue/MUS-630/make-exhibition-participation-authoritative)
- [MUS-631](https://linear.app/museumlite/issue/MUS-631/make-collection-group-membership-authoritative)
