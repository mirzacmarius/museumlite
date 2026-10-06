## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Auditors retrieve years of filtered evidence with stable actor/subject meaning and correlated object/case timelines.

Batch 4; recommendations R13. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Indexed cursor queries reach beyond the latest thousand events and label counts honestly.
- [ ] Actor/subject snapshots, immutable corrections and growing historical child records preserve original content/order.
- [ ] Date filters, detail/diffs, correlations and authorized history export have working recovery and pagination.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-627](https://linear.app/museumlite/issue/MUS-627/capture-retained-object-condition-assessments)
- [MUS-628](https://linear.app/museumlite/issue/MUS-628/execute-guarded-movements-and-delayed-requests)
