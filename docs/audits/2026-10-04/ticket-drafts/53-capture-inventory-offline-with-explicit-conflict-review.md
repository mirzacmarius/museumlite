## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Approved field devices retain secure inventory drafts offline and synchronize without silently overwriting authoritative records.

Batch 8; recommendations R33. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Resolve supported devices, encrypted local retention, revocation, observation identity and conflict policy before implementation.
- [ ] Interrupted/repeated sync deduplicates observations and presents source changes for review.
- [ ] Offline/online status, queue/error/conflict recovery and device data clearing have complete demonstrable behavior.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-662](https://linear.app/museumlite/issue/MUS-662/verify-inventory-with-scanning-labels-and-exceptions)
