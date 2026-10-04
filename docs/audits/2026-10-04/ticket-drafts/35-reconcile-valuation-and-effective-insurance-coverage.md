## Parent

[MUS-610](https://linear.app/museumlite/issue/MUS-610/museum-operations-integrity-and-workflow-improvement-program-approval)

## What to build

Staff see purpose/currency/date appraisals and effective single-target coverage instead of ambiguous current values.

Batch 5; recommendations R19. The ticket breakdown is approved for publication. Publication approval does not authorize implementation; explicit approval of the associated batch remains required.

## Acceptance criteria

- [ ] Canonical purpose-specific appraisal and supersession preserve historical values and explain current projections.
- [ ] Each coverage has one typed target and valid policy/date interval; multi-target legacy rows require reviewed reconciliation.
- [ ] UI/alerts/totals distinguish gaps, expiry, purpose and currencies; no unsupported combined monetary total is shown.
- [ ] Include functioning backend/schema, UI, validation, permissions and recovery behavior where affected; no placeholder controls or advertised unsupported capability.
- [ ] Verify external behavior through the approved Convex API/HTTP/browser boundaries, including authorization, failure/retry and adjacent regressions; report deterministic results and rollout limitations.

## Blocked by

- [MUS-616](https://linear.app/museumlite/issue/MUS-616/protect-permanent-evidence-from-every-cleanup-path)
