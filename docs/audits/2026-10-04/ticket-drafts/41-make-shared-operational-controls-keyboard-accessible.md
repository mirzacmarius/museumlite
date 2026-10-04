## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff complete representative table, filter, dialog and form tasks with semantic controls and predictable keyboard focus.

Batch 6; recommendations R26. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Use meaningful headers/labels/expanded states and reachable primary actions in shared controls.
- [ ] Focus, dialog dismissal/error focus, selection and long-content overflow work in actual browser tasks.
- [ ] Affected list/form consumers retain selection, authorization and recovery behavior without a blanket conformance claim.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-649](https://linear.app/museumlite/issue/MUS-649/make-operational-forms-resumable-and-recoverable)
- [MUS-650](https://linear.app/museumlite/issue/MUS-650/preserve-list-context-and-detail-recovery)
