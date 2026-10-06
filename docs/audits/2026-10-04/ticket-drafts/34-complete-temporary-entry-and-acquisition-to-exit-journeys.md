## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff receipt temporary property, branch to acquisition/accession or return, and record recipient exit using one object identity.

Batch 5; recommendations R21. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Entry captures depositor/owner, purpose, temporary identifier, custody, condition, responsibility and due dates.
- [ ] Acquisition/title evidence remains separate from possession and permanent accession policy.
- [ ] Rejected acquisitions/deposits/incoming custody exit to a recorded recipient without fabricated deaccession; retained registers and existing loan flows agree.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-623](https://linear.app/museumlite/issue/MUS-623/complete-draft-to-verified-accession-intake)
- [MUS-629](https://linear.app/museumlite/issue/MUS-629/complete-per-item-loan-dispatch-and-returns)
- [MUS-642](https://linear.app/museumlite/issue/MUS-642/reuse-parties-across-institutional-procedures)
