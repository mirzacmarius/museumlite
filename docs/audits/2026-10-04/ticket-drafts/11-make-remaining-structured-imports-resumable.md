## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Every other supported structured import follows the same safe row-outcome and correction contract.

Batch 2; recommendations R07. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Inventory supported object and operational import types and implement complete replay-safe behavior for each existing advertised type.
- [ ] Date, status, reference and numbering validation preserves uncertainty instead of guessing values.
- [ ] Mapping, validation, failed-row correction and progress UI round-trip accepted data; unsupported types are not advertised.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-620](https://linear.app/museumlite/issue/MUS-620/make-accession-import-retries-and-progress-safe)
