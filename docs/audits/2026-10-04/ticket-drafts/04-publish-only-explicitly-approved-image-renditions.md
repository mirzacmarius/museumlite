## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff approve individual eligible images and preview public renditions while operational files and originals remain private.

Batch 1; recommendations R02. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Approval, preview, unpublish and version/rights invalidation work with scoped permissions.
- [ ] All anonymous public detail/list/thumbnail/download responses fail closed for restricted, unknown-rights, unapproved or missing-rendition files.
- [ ] Legacy attachments default private without deletion; original downloads have a separate explicit policy and historical URL exposure is assessed at rollout.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-612](https://linear.app/museumlite/issue/MUS-612/close-cross-organization-batch-and-job-reads)
