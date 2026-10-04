## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff capture one resumable draft, satisfy source policy, approve accession and continue cataloguing without repeated entry.

Batch 2; recommendations R09, R24. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Shared draft/catalog field contracts preserve every accepted field, including specialized metadata, through publication.
- [ ] Draft and existing-object accessions obey the same backend source/approval rules; authorized exceptions retain reasons.
- [ ] Validation, save/recovery, review and resulting object/register links are functional and preserve one object identity.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-616](https://linear.app/museumlite/issue/MUS-616/protect-permanent-evidence-from-every-cleanup-path)
- [MUS-619](https://linear.app/museumlite/issue/MUS-619/apply-preserved-identifier-policy-to-catalog-and-accession)
