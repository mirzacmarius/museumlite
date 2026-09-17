# Arena synthesis: fix-plan designs D1-D3

Base: candidate B (grok). Judge scores A 23, B 23, C 20. My independent scores A 22, B 22, C 19. Tie twice, same tiebreak twice: the smaller API wins per laziness. Agreement confirms the pick.

## The shape

D1: occupancy join table with `by_organization_kind_and_value` plus `by_collection`. Collection write paths replace rows in the same mutation. `checkUsage` keeps its signature. `incrementUsage` and dead counter fields go. Backfill runs once per org, then cutover with no fallback.

D2: hard delete the four unused report queries. Zero app callers verified by two candidates. Dashboard continuation stays the promotion template.

D3: shared drain helper plus existing `getBatch` for hydrate. `collections.list` keeps its contract and its tests. Five first-page-only callers drain to `isDone` under a cap.

## Grafts

From A: bounded probe honesty, additive. Cap hydrated names at 20, probe count to 1001, add `truncatedNames` flag. No breaking return change.
From A: structural meta-test asserting `api.collections.list` has exactly two importers, so a sixth first-page-only caller fails CI.
From C: nothing structural. `truncatedNames` naming matches the A graft above.

## Rejections

Internal throwing stubs for dead reports. Git history plus the dashboard pattern beats maintained dead surface.
`pickOptions` plus `getManyByIds` new API. Better engineering, but it changes browse-all product behavior and quintuples the D3 build. Recorded as follow-up instead.
Breaking `UsageCount` tagged return. Additive flag carries the same honesty without churning three comboboxes.

## Verification

Red-flag screen: no shallow modules (each helper hides index plus hydrate or loop), no pass-through without policy (wrappers add permission), no temporal split, term parsing centralized. Rubric recheck: bounded, authed, additive, indexed, testable. Dropouts: none.

## Deviations (added during implementation loop)

- D1 counter fields stayed. `usageCount` and `lastUsedAt` remain on the four option tables because `list()` returns them and `create` plus `seedMet` write them (measured by U6). Only the four `incrementUsage` mutations were deleted. Stored counts are now stale by design. Frontend delete dialogs read `checkUsage` results, not stored fields. Follow-up: remove the fields from `list()` validators once no reader needs them.
- Importer meta-test allows four files, not two. The drain helper and the onboarding one-row existence probe join the allowlist alongside the two looping call sites (measured in U10). A new first-page picker anywhere else still fails CI.
