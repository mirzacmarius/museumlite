## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff generate reproducible financial/insurance and provenance reports with correct currency, validity and evidence meaning.

Batch 5; recommendations R29. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Use canonical appraisal, coverage and provenance datasets with explicit filters/as-of/version.
- [ ] Expose real complete artifacts, currency-grouped totals and source/uncertainty information under scoped access.
- [ ] Board/insurer/research outputs have working preview, progress, download and failure handling without stub success.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-639](https://linear.app/museumlite/issue/MUS-639/produce-bounded-complete-export-artifacts)
- [MUS-643](https://linear.app/museumlite/issue/MUS-643/record-evidence-backed-uncertain-provenance)
- [MUS-645](https://linear.app/museumlite/issue/MUS-645/reconcile-valuation-and-effective-insurance-coverage)
