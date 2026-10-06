## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Integration administrators see real delivery attempts and safely replay failed outgoing events.

Batch 7; recommendations R31. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Retain stable event intent/payload version and bounded attempts with idempotency, backoff and terminal outcomes.
- [ ] Existing signed authorized webhooks remain functional and payload visibility/replay is tenant-scoped.
- [ ] Delivery log, fixture endpoint test and retry UI work; transient/permanent/revoked endpoint behavior is verified without real recipient messages.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
