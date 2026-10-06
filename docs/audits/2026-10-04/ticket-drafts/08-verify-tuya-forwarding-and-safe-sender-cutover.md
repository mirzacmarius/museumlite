## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

A selected Tuya gateway/cloud adapter forwards verified normalized measurements without interrupting any existing monitoring.

Batch 1; recommendations R03. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Resolve the actual model, gateway/cloud transport, payload units/scaling, message identity and upstream authentication before implementation/cutover.
- [ ] Verify upstream messages and bind each probe before forwarding; replay, delayed packets, revocation and disconnects have demonstrable outcomes.
- [ ] Prove selected-device forwarding before advertising Tuya connectivity or disabling a real old sender; secrets are not exposed and insecure rollback is prohibited.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-617](https://linear.app/museumlite/issue/MUS-617/register-devices-and-receive-authenticated-environmental-readings)
