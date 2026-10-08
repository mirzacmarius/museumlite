# MUS-610 Batch 3 fix, chain B

Branch `codex/mus-610-batch-3-fixes-b`, cut from `codex/mus-610-batch-3`. Scope is the four findings assigned to this chain. Loan, exhibition, and transit files were not edited.

## Should-fix — Group add, remove, and backfill can mint a second primary

- **Ticket:** MUS-631
- **Changed:** `packages/backend/convex/collectionGroups.ts`
- **What changed:** `addItems` and `removeItems` assign roles through `syncCollectionGroupMemberships`, so a legacy pointer cannot become a second explicit primary while another primary membership exists. Removing a primary membership requires `replacementPrimaryGroupId` in the same call and updates the compatibility pointer to that group. `backfillMemberships` still reports `conflicting_primary`, `invalid_group`, and `duplicate_membership`, and it leaves that object's membership rows unchanged.
- **Tests:**
  - `adding the legacy pointer group does not mint a second primary membership`
  - `removing a primary membership requires a replacement primary in the same call`
  - `backfill leaves conflicting primary memberships unchanged`
  - `ambiguous legacy roles are reported and retained for staff review` (now asserts the pointer row is not inserted)

## Should-fix — In-flight transfers skip the observed-source check

- **Ticket:** MUS-635
- **Changed:** `packages/backend/convex/utils/institutionTransferEvidence.ts`, `packages/backend/convex/objectMoves.ts`
- **What changed:** A missing `approvedSourceLocationId` is a conflict. Accept throws until the source organization re-approves. Re-approval is limited to an `awaiting_acceptance` request that still has no observed source: it binds the object's current location once and does not create another deaccession. `null` remains a real observation that the object had no location at approval.
- **Test:** `in-flight acceptance rejects a missing observed source after the object moves`

## Minor — Executed transfer accept succeeds before the permission check

- **Ticket:** MUS-635
- **Changed:** `packages/backend/convex/objectMoves.ts`
- **What changed:** `accept` requires the target organization's `organization.manage_settings` before the executed short-circuit. A second accept by that organization still returns without writing another custody event.
- **Test:** `executed accept requires target manage_settings before the idempotent success`

## Minor — Condition comparison drops the previous accepted assessment

- **Ticket:** MUS-627
- **Changed:** `packages/backend/convex/conditionAssessments.ts`, `packages/backend/convex/schema.ts`
- **What changed:** `getForObject` loads the two most recently accepted assessments with index `by_collection_and_status_and_acceptedAt` (`collectionId`, `status`, `acceptedAt`) and chooses the previous row by `acceptedAt`. Drafts between accepts no longer hide the prior accepted assessment.
- **Tests:**
  - `comparison keeps the previous accepted assessment when drafts fill the recent window`
  - `comparison orders the previous accepted assessment by acceptedAt`

## Not fixed

Nothing in this chain's four findings was left open. No loan, exhibition, transit, or `utils/locationIntegrity.ts` edits were required.

## Checks

From `packages/backend`:

```bash
bun run test:once collectionGroupMemberships.test.ts conditionAssessments.test.ts objectMoves.test.ts
```

**Result:** 49 passed (12 group membership, 9 condition assessment, 28 object move).

From the repo root:

- `bun run typecheck:all`: passed.
- `bun run lint`: failed on warnings and errors that are already on this branch and outside these commits: `convex/utils/loanItemState.ts`, `convex/utils/loanMovement.ts`, `tests/exhibitionPhysicalHandoffs.test.ts`, `tests/transitHandoffs.test.ts`, and `condition-assessment-panel.tsx`. Those files belong to the parallel chain or to earlier batch work and were not changed here.
