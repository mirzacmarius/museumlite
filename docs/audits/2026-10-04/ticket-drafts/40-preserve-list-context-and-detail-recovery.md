## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Filtering, opening and returning to operational records preserves URL state and offers useful missing/forbidden/error recovery.

Batch 6; recommendations R25. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Search/filter/sort/page and originating-list context survive reload/share/back navigation.
- [ ] Distinguish loading, no data, no match, missing, forbidden, unavailable and stale conflicts with working actions.
- [ ] Backend pagination/filter results and detail boundaries agree across representative queues and catalog lists.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-626](https://linear.app/museumlite/issue/MUS-626/make-work-queues-and-object-selectors-complete)
