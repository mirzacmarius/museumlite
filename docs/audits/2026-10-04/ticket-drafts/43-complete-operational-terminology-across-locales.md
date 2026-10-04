## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff receive consistent translated operational labels, errors and feedback across all registered locales.

Batch 6; recommendations R27. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Coordinate with existing localization work and scope this ticket to remaining terminology/workflow gaps rather than duplicate completed fixes.
- [ ] Translate real validation/loading/empty/toast/approval strings with correct interpolation and date/number/currency policy.
- [ ] Review long strings and complete changed task journeys in supported layouts; record explicit fallback behavior.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-648](https://linear.app/museumlite/issue/MUS-648/align-vocabulary-navigation-and-capability-policy)
- [MUS-652](https://linear.app/museumlite/issue/MUS-652/complete-responsive-field-movement-and-receipt-tasks)
