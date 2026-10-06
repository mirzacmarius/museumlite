## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

An accession import can be retried, resumed and corrected without duplicate register records or misleading progress.

Batch 2; recommendations R07. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Persist stable job/source-row results and return the stored result on replay.
- [ ] Track attempted/accepted/failed outcomes through terminal states, cancellation and resumed correction with usable row errors.
- [ ] Use shared validated parsers, bounded processing and scoped polling; replay and interruption retain one intended accession per accepted row.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-612](https://linear.app/museumlite/issue/MUS-612/close-cross-organization-batch-and-job-reads)
- [MUS-619](https://linear.app/museumlite/issue/MUS-619/apply-preserved-identifier-policy-to-catalog-and-accession)
