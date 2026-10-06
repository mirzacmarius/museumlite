## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff manage scoped device credentials and receive deduplicated temperature/humidity readings with trustworthy timestamps and health status.

Batch 1; recommendations R03. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Registration, one-time credential display, binding, rotation/revocation and last-seen/error UI work end to end.
- [ ] HTTP ingestion validates device/probe, tenant/location, units, timestamp, rate limits and stable reading identity; retries create one reading and logical alert contribution.
- [ ] Anonymous, revoked, malformed and wrong-location submissions make no writes; manual staff readings remain authorized and audited.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- None (technical prerequisites only; explicit batch approval is still required).
