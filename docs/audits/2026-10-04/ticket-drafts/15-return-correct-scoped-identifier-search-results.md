## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Catalog/global search finds actual normalized identifier or descriptive matches rather than unrelated lexical successors.

Batch 2; recommendations R11. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Use genuine prefix boundaries or appropriate indexed text search with explicit scope/ranking.
- [ ] Foreign and unauthorized records are absent; missing/no-match and filter behavior is consistent.
- [ ] Direct, global and relevant entity search callers remain functional with representative identifier/text fixtures.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-619](https://linear.app/museumlite/issue/MUS-619/apply-preserved-identifier-policy-to-catalog-and-accession)
