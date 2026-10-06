## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Legitimate users can recover/sign in while public responses do not reveal password-account existence.

Batch 6; recommendations R32. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Review existing provider/client branching and replace durable public account-existence signals with neutral behavior.
- [ ] Valid recovery/sign-in remains usable and abuse controls cover the surrounding auth flow.
- [ ] Compare existing/nonexistent/password/other-provider cases at public boundary and UI without introducing account takeover or denial regressions.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
