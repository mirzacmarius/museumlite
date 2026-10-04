## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Recipients receive only permitted category/channel notifications and can inspect trustworthy bell/email outcomes.

Batch 7; recommendations R23, R31. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] One preference-aware dispatcher controls all affected emitters and validates recipient/content access.
- [ ] Instant email uses durable delivery state; disabled categories do not send and unsupported digest choices are not falsely advertised.
- [ ] Notification center, settings and retry/error outcomes work with deduplication and fixture delivery.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-657](https://linear.app/museumlite/issue/MUS-657/inspect-and-retry-durable-outgoing-webhooks)
