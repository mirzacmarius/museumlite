## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Recipients choosing a digest receive one authorized grouped delivery on the intended schedule.

Batch 7; recommendations R23. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Offer daily/weekly choices only with a working scheduled worker and controlled-clock calendar tests.
- [ ] Preferences, category exclusions, access changes and replay cannot duplicate or disclose digest contents.
- [ ] Settings, delivery state and missed/retry recovery correspond to actual fixture email output.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-658](https://linear.app/museumlite/issue/MUS-658/honor-notification-preferences-and-trace-instant-delivery)
