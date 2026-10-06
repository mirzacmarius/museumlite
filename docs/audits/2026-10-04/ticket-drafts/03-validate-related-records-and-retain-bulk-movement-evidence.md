## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Object, attachment and operational edits reject foreign or invalid references, and bulk/exhibition internal moves leave accountable history.

Batch 1; recommendations R04. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Validate referenced entities, destinations and blob ownership at write or delayed execution time.
- [ ] Valid bulk and exhibition internal location changes record observed source, actor and reason; invalid destinations leave no partial writes.
- [ ] Selectors and conflict/partial-job feedback work, and legacy invalid references are reported without invented repairs.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-612](https://linear.app/museumlite/issue/MUS-612/close-cross-organization-batch-and-job-reads)
