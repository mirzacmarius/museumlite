## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff select shared people/institutions in contextual roles while historical names remain preserved.

Batch 5; recommendations R18. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Typed party/relationship links enforce existence, tenant and permissions across acquisition, loan, donor and appraisal contexts.
- [ ] Reusable picker, role history and reviewed duplicate suggestions work without automatic identity merging.
- [ ] Retain original named assertions/contact snapshots and provide actionable legacy-link review.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-613](https://linear.app/museumlite/issue/MUS-613/validate-related-records-and-retain-bulk-movement-evidence)
- [MUS-616](https://linear.app/museumlite/issue/MUS-616/protect-permanent-evidence-from-every-cleanup-path)
