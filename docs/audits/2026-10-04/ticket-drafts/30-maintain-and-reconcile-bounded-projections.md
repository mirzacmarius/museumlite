## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Large institutions receive bounded dashboard/report/usage queries and reviewable projection discrepancies.

Batch 4; recommendations R14. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Maintain aggregate/time buckets from agreed events and metric definitions, with bounded rebuild checkpoints.
- [ ] All relevant writers update projections consistently; failed/replayed rebuilds are safe.
- [ ] Measure synthetic small/large institutions and expose admin health/reconciliation outcomes without guessed historical repair.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-636](https://linear.app/museumlite/issue/MUS-636/retrieve-complete-stable-audit-history)
- [MUS-638](https://linear.app/museumlite/issue/MUS-638/align-operational-metrics-and-drill-downs)
