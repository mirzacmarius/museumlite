## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

An operator rehearses additive migration and restores records plus files on an isolated target with verifiable evidence.

Batch 4; recommendations R30. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Confirm target and recovery objectives, preserve original snapshot and rehearse rerunnable bounded migration.
- [ ] Restore verifies IDs, counts, file/reference integrity and reconciled projections on a disposable nonproduction environment.
- [ ] Runbook/status/rollback outcomes are concrete; missing access or failed evidence is disclosed and unsafe rollback is prohibited.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-611](https://linear.app/museumlite/issue/MUS-611/make-backend-compilation-a-required-gate)
- [MUS-616](https://linear.app/museumlite/issue/MUS-616/protect-permanent-evidence-from-every-cleanup-path)
- [MUS-640](https://linear.app/museumlite/issue/MUS-640/maintain-and-reconcile-bounded-projections)
