## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Conservators see one actionable breach episode with updates and escalation rather than a new alert for every reading.

Batch 7; recommendations R23. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Use authenticated deduplicated observations with explicit late/out-of-order and threshold/recovery policies.
- [ ] Open/update/recover/escalate an episode idempotently and honor category/channel preferences.
- [ ] Monitoring/notification views show evidence, state and last-seen distinctions without interpreting disconnected devices as healthy.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-617](https://linear.app/museumlite/issue/MUS-617/register-devices-and-receive-authenticated-environmental-readings)
- [MUS-658](https://linear.app/museumlite/issue/MUS-658/honor-notification-preferences-and-trace-instant-delivery)
