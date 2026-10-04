## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Registrars dispatch and partially or fully receive loan items with explicit condition and destination, including incoming lender exits.

Batch 3; recommendations R08, R10, R17. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Retain origin and distinct outgoing/incoming assessment links; item dispatch/return state is independent of condition text.
- [ ] Receipt confirms destination and evidence, reconciles parent/outstanding items and releases occupancy correctly.
- [ ] Incoming return creates recorded exit to lender, not new synthetic deaccession; legacy unknowns and assertions remain preserved.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-627](https://linear.app/museumlite/issue/MUS-627/capture-retained-object-condition-assessments)
- [MUS-628](https://linear.app/museumlite/issue/MUS-628/execute-guarded-movements-and-delayed-requests)
