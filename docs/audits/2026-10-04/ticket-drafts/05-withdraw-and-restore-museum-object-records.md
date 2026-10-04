## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Authorized staff archive an object with a reason and restore it with its permanent identity and linked evidence intact.

Batch 1; recommendations R05. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Routine and archive views, reason capture, register access and restore controls have functioning backend and permissions.
- [ ] Withdrawal and restore retain identifiers, attachments and related accession/disposal/care/custody evidence.
- [ ] Dependency conflicts and unavailable legacy evidence are explicit; no guessed repair or hard-delete fallback is offered.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
