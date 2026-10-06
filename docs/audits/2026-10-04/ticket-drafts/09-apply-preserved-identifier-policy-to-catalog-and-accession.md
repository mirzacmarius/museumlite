## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff assign and find stable institutional identifiers under an explicit uniqueness policy without rewriting historical register numbers.

Batch 2; recommendations R07, R11. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Validate the accepted register/organization identifier policy across direct catalog and accession numbering paths.
- [ ] Normalize searchable identifiers additively and surface reviewed legacy conflicts without auto-renumbering or deletion.
- [ ] Authorized forms show actionable duplicate/conflict results, and concurrent assignments cannot violate the policy.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
