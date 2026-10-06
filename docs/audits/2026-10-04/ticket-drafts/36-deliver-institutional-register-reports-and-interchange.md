## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff generate real accession, disposal, custody and condition register outputs with documented exchange profiles.

Batch 5; recommendations R29. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Profiles produce actual authorized artifacts with criteria/as-of/generator identity and complete retained evidence.
- [ ] Document typed interchange encoding and validate representative round-trips, without an accreditation/compliance claim.
- [ ] Preview/run/download/error UI works; missing historical facts remain explicit and unsupported profiles are unavailable.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-624](https://linear.app/museumlite/issue/MUS-624/enforce-stage-specific-disposal-decisions)
- [MUS-629](https://linear.app/museumlite/issue/MUS-629/complete-per-item-loan-dispatch-and-returns)
- [MUS-636](https://linear.app/museumlite/issue/MUS-636/retrieve-complete-stable-audit-history)
- [MUS-637](https://linear.app/museumlite/issue/MUS-637/run-honest-timezone-aware-kpi-schedules)
- [MUS-639](https://linear.app/museumlite/issue/MUS-639/produce-bounded-complete-export-artifacts)
