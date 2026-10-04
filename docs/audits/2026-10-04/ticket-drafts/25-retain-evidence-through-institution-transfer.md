## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

An authorized two-party object transfer retains accountable custody and institutional evidence rather than bypassing movement rules.

Batch 3; recommendations R10. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Preserve two-party authorization and transfer eligibility while recording observed custody/location and retained identity.
- [ ] Mapped destination, links and access follow explicit transfer policy without silent evidence/file loss.
- [ ] Transfer review/acceptance/conflict UI and legacy/history views remain consistent and reject unauthorized or replayed changes.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-628](https://linear.app/museumlite/issue/MUS-628/execute-guarded-movements-and-delayed-requests)
