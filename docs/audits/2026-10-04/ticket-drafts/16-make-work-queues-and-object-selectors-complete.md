## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff can reach every matching accession and selectable object with complete server filtering and truthful totals.

Batch 2; recommendations R11. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Paginate beyond the first hundred queue entries and display total versus loaded counts accurately.
- [ ] Search-on-demand selectors reach objects beyond the old five-thousand cap without draining whole organizations.
- [ ] Filtering, pagination, loading, errors and selection recovery retain user context and authorization.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-625](https://linear.app/museumlite/issue/MUS-625/return-correct-scoped-identifier-search-results)
