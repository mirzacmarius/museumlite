## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff take a request through rights/evidence review, approved terms and derivative delivery with retained use records.

Batch 8; recommendations R35. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Capture requester/purpose, rights evidence, decision, versioned terms/expiry and approved derivative without exposing private originals.
- [ ] Request review, approved delivery and expiry/revocation outcomes are usable and permission-scoped.
- [ ] Durable delivery and retry evidence is verifiable; optional metadata assistance is deferred until separately specified and never alters authoritative history.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-614](https://linear.app/museumlite/issue/MUS-614/publish-only-explicitly-approved-image-renditions)
- [MUS-642](https://linear.app/museumlite/issue/MUS-642/reuse-parties-across-institutional-procedures)
- [MUS-657](https://linear.app/museumlite/issue/MUS-657/inspect-and-retry-durable-outgoing-webhooks)
- [MUS-658](https://linear.app/museumlite/issue/MUS-658/honor-notification-preferences-and-trace-instant-delivery)
