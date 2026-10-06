## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff complete operational forms with shared draft/field contracts, contextual validation and recoverable interruption.

Batch 6; recommendations R24. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Use accepted object/party contracts without retyping captured data or losing supported fields.
- [ ] Save/dirty/conflict/validation and error recovery work across selected case and catalog forms.
- [ ] Backend policy remains authoritative; schema/draft changes are versioned/additive and supported specialized/library forms regressions pass.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-623](https://linear.app/museumlite/issue/MUS-623/complete-draft-to-verified-accession-intake)
- [MUS-642](https://linear.app/museumlite/issue/MUS-642/reuse-parties-across-institutional-procedures)
