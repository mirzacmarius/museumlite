## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Authorized staff can read media, loan metadata, import diagnostics and relationships without any foreign-organization disclosure.

Batch 1; recommendations R01. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Authorize every actual referenced or returned record, including foreign IDs in every batch position.
- [ ] Anonymous, nonmember and wrong-role callers receive no foreign URLs or diagnostic content.
- [ ] Valid same-organization batches and job polling retain usable results and recovery states.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
