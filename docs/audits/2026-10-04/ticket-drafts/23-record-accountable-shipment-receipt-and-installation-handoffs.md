## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Transport arrival, acceptance and installation update their linked loan/exhibition cases only from recorded handoffs.

Batch 3; recommendations R10, R17. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Shipment arrival does not itself attest accepted custody, installation or object return.
- [ ] Per-item receipt links responsible actor, observed destination and condition evidence through the shared movement contract.
- [ ] Transit/installation actions, task progress and related cases agree under retry, partial arrival and wrong-role tests.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-629](https://linear.app/museumlite/issue/MUS-629/complete-per-item-loan-dispatch-and-returns)
- [MUS-632](https://linear.app/museumlite/issue/MUS-632/confirm-exhibition-installation-and-physical-returns)
