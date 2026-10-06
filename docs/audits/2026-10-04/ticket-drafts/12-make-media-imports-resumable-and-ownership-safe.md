## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Media import interruption and retry retain one authorized attachment outcome per source item with honest progress.

Batch 2; recommendations R04, R07. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Reuse durable item outcomes for mapping, upload/link completion and retries without duplicate attachments.
- [ ] Validate upload ownership and object context, retain originals and report failed file outcomes safely.
- [ ] Import UI supports resume/cancel/error recovery; credential and foreign-file cases are refused.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-613](https://linear.app/museumlite/issue/MUS-613/validate-related-records-and-retain-bulk-movement-evidence)
- [MUS-620](https://linear.app/museumlite/issue/MUS-620/make-accession-import-retries-and-progress-safe)
