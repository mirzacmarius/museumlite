## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Expose and repair the backend compiler failures so the advertised local and CI checks verify the whole application.

Batch 1; recommendations R06. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Fresh root and standalone backend compilation pass without weakened strictness or excluded production code.
- [ ] Production, seed and test diagnostics are corrected and existing tests still pass.
- [ ] The finite check is part of the documented workspace and CI gate.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
