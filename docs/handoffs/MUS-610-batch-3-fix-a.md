# MUS-610 Batch 3 fix chain A

Branch `codex/mus-610-batch-3`. Scope is the stage-A findings in `docs/handoffs/MUS-610-batch-3-review.md` for MUS-632, MUS-629, and MUS-633. MUS-627, MUS-631, and MUS-635 were left for the parallel thread.

## Blocker — Exhibition close and activation can skip the new handoff gates

`packages/backend/convex/utils/exhibitionWorkflow.ts`

`skipInstallationCheck` and `skipDeinstallationCheck` still skip incomplete checklists. They no longer skip participant rules. Activation requires every participant `installed`. Close requires each participant `returned` or a stored return exception.

Tests: `activate ignores skipInstallationCheck for participants`, `close ignores skipDeinstallationCheck while a participant is installed`, `skipInstallationCheck still skips the checklist once participants are installed` in `packages/backend/tests/exhibitionPhysicalHandoffs.test.ts`.

## Blocker — Cancelling a dispatched loan leaves the object out of custody

`packages/backend/convex/utils/loanLifecycle.ts`, `packages/backend/convex/utils/locationIntegrity.ts`

Cancel is refused when any item is already dispatched. Reversing dispatch would write a movement that puts the object back at its origin without a receipt, which disagrees with the fact that it has left. Staff close that loan by recording a return. `isCollectionInExternalCustody` ignores items whose loan is `cancelled` or `returned`, so an already-cancelled row does not keep blocking later moves.

Tests: `cancel after dispatch is refused and leaves custody unchanged`, `a cancelled loan does not keep a dispatched item in external custody` in `packages/backend/tests/loanCustody.test.ts`.

## Blocker — A partially returned item is still treated as on loan

`packages/backend/convex/utils/loanOccupancy.ts`, `packages/backend/convex/utils/loanItemState.ts`

An item occupies a loan only when that item is not returned. `conditionIn` still counts as returned only for legacy rows that have no `custodyStatus`. The parent loan can stay `dispatched`.

Test: `a partially returned item is not still on loan`.

## Blocker — Loan-linked transit receipt can cite the wrong movement

`packages/backend/convex/utils/transitPhysicalHandoff.ts`, `packages/backend/convex/utils/loanCustody.ts`, `packages/backend/convex/transit.ts`

The receipt drives the loan return through the shared movement command with `kind: "transit_receipt"`, the observed source, and `transitItemId`, and stores that returned id. If the command writes no row, the receipt fails instead of scanning `locationHistory`. Incoming and outgoing receipts require an accepted assessment or real condition text.

Tests: `incoming return receipt stores the departure it wrote`, `outgoing return receipt does not cite a movement when the destination is unchanged`, `loan return receipt rejects an observed source that is not current`, `return shipment receipt requires condition evidence` in `packages/backend/tests/transitHandoffs.test.ts`.

## Should-fix — Return invents condition text

`packages/backend/convex/utils/loanCustody.ts`, `packages/backend/convex/schema.ts` (`locationHistory.toLocationId` optional)

A return is rejected until the caller supplies an accepted assessment or a non-empty condition note. Dispatch writes `loan_dispatch` with the origin as `fromLocationId` and no destination, so the row does not pretend the object arrived somewhere. The return writes `loan_return` through `moveCollectionToLocation`. Legacy `conditionIn` is still the returned signal only when `custodyStatus` is absent.

Tests: `return without condition evidence is rejected`, `dispatch records loan_dispatch from the origin`, `outgoing return records loan_return`. `should return active loan directly (without dispatch)` in `packages/backend/tests/loans.test.ts` now sends real condition text.

## Should-fix — Incoming lender exit does not release the location

`packages/backend/convex/utils/loanCustody.ts`, `packages/backend/convex/utils/locationIntegrity.ts` (`recordCustodyDeparture`), `loanCustodyExits.fromLocationId`

Lender exit clears `currentLocationId` in the same transaction and writes a departure whose `fromLocationId` is the last on-site place (current location, or the dispatch origin after the location was already cleared). The exit row stores that place. Exit is refused while an exhibition participant is `installed` or `deinstalled` without a return exception.

Tests: `incoming lender exit releases the location`, `incoming lender exit refuses an installed exhibition object`.

## Should-fix — Exhibition return always claims the original location

`packages/backend/convex/utils/exhibitionObjectLocation.ts`

`returnedToOriginalLocation` is true only when the destination equals `originalLocationId`.

Test: `exhibition return to another location does not claim the original location`.

## Deliberately not fixed

- MUS-627 condition comparison, MUS-631 group primary membership, and MUS-635 in-flight transfer source checks. Those files stay with the parallel thread: `conditionAssessments.ts`, `collectionGroups.ts`, `objectMoves.ts`, `institutionTransferEvidence.ts`.

## Checks

- `bun x vitest run tests/loanCustody.test.ts tests/exhibitionPhysicalHandoffs.test.ts tests/transitHandoffs.test.ts tests/loans.test.ts tests/loanGuards.test.ts` — 52 passed.
- Adjacent: `exhibitions.test.ts`, `transit.test.ts`, `locations.test.ts`, `guardedMovements.test.ts` passed. `referenceIntegrity.test.ts` still fails `exhibition installation observes the current source and invalid return leaves status intact` with `Review legacy exhibition participation before adding objects`. That guard was already in `addExhibitionObjectHandler` and this chain did not change it.
- `bun run typecheck:all` passed.
- `bun run lint` failed on existing issues outside this chain: `condition-assessment-panel.tsx` index keys (MUS-627) and unused symbols already present in `loanMovement.ts`, `loanItemState.ts` `outstandingLoanItems`, and the exhibition/transit test helpers. No new lint findings were reported in the edited logic.

Commits: `82e54416`, `aee393ff`, `639b94f4`. Not pushed. No Linear update, no deploy, no Convex cloud commands.
