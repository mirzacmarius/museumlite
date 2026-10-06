## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Field staff compare expected and observed objects/locations in scan sessions and review mismatches before reconciliation.

Batch 8; recommendations R33. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Session scope, labels/reprint, scan observations and expected-versus-observed progress work on supported devices.
- [ ] Observations retain actor/time/evidence and do not automatically become custody transfers.
- [ ] Exception review links to guarded authorized movement/repair, with safe retry and retained institutional history.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-628](https://linear.app/museumlite/issue/MUS-628/execute-guarded-movements-and-delayed-requests)
- [MUS-652](https://linear.app/museumlite/issue/MUS-652/complete-responsive-field-movement-and-receipt-tasks)
- [MUS-654](https://linear.app/museumlite/issue/MUS-654/review-and-repair-documentation-quality-exceptions)
