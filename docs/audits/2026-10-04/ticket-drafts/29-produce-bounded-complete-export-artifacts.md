## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff export large authorized selections through resumable jobs and download complete typed artifacts.

Batch 4; recommendations R14, R29. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Use bounded continuations, progress/cancel/resume, safe retry and scoped artifact access.
- [ ] Typed columns preserve date/number/text semantics; defined CSV handling prevents formula interpretation without header-name guessing.
- [ ] Filters/as-of/version, counts and checksum reconciliation establish completeness and documented format compatibility.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
