## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff run supported real KPI reports at intended local times and see unsupported or failed output truthfully.

Batch 4; recommendations R12. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Supported generator produces usable stored output; legacy unsupported types cannot be marked successful.
- [ ] Schedule identity, timezone/DST/month boundaries and controlled-clock retries produce correct runs.
- [ ] UI distinguishes generated/stored/delivered/unavailable results and does not advertise an unimplemented email channel.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
