# MUS-610 Batch 3 review

Branch `codex/mus-610-batch-3` at `f454fe38` (draft PR #152). Scope: `git diff origin/main...HEAD`. Tickets: MUS-627, 630, 631, 635, 629, 634, 632, 633.

## Blocker — Exhibition close and activation can skip the new handoff gates

- **Ticket:** MUS-632
- **Where:** `packages/backend/convex/exhibitions.ts:367` and `:376`; `packages/backend/convex/utils/exhibitionWorkflow.ts:327` and `:413`
- **Scenario:** Any caller with exhibition update permission can activate or close without the physical outcome the ticket requires. `exhibitions.activate({ skipInstallationCheck: true })` activates an approved exhibition while every participant is still `pending`. `exhibitions.close({ skipDeinstallationCheck: true })` closes an active exhibition while objects are still `installed`, with no return movement and no `returnException`. The new outstanding-outcome check is behind that same client flag, and nothing records a reason. `loanGuards.test.ts` already uses `skipInstallationCheck: true` to get past the install rule; there is no test that a normal close is rejected while a participant is installed.
- **Fix:** Ignore those flags for the participant rules, or restrict them to an internal migration. Activation should require every participant `installed`. Close should require each participant `returned` or a stored return exception. Keep checklist skips separate if operations still need them.

## Blocker — Cancelling a dispatched loan leaves the object out of custody

- **Ticket:** MUS-629
- **Where:** `packages/backend/convex/utils/loanLifecycle.ts:209`; `packages/backend/convex/utils/loanMovement.ts:96`; `packages/backend/convex/utils/locationIntegrity.ts:67`
- **Scenario:** Dispatch marks the item `custodyStatus: "dispatched"` and clears `currentLocationId` (`loanCustody.ts:101`). Cancel only sets the loan to `cancelled` and the collection back to `active`. The item stays `dispatched`, and the location is not restored. `isCollectionInExternalCustody` treats any outgoing item with `custodyStatus === "dispatched"` as out on loan, and it does not look at the loan status. The next guarded move, exhibition install, or transit receipt then throws "Object is out on loan" for an object whose loan is cancelled and whose gallery place is gone. No test covers cancel after dispatch.
- **Fix:** On cancel, refuse when any item is already dispatched, or reverse each dispatched item in the same transaction: restore the origin location with a movement, and set custody back to `pending`. External-custody checks should ignore items whose loan is `cancelled` or `returned`.

## Blocker — A partially returned item is still treated as on loan

- **Ticket:** MUS-629, interaction with MUS-632 and MUS-633
- **Where:** `packages/backend/convex/utils/loanOccupancy.ts:16`; used from `packages/backend/convex/utils/exhibitionObjectLocation.ts:170` and `packages/backend/convex/loans.ts:375`
- **Scenario:** An outgoing loan with two items is dispatched, then one item is received back. That item is `custodyStatus: "returned"` and the collection is `active`, but the parent loan stays `dispatched` until the other item returns (`loanCustody.test.ts` asserts this). `collectionHasOccupyingLoan` returns true for every item on a `pending`, `active`, or `dispatched` loan and never reads item custody. Staff cannot install the returned object, add it to another loan, or activate an exhibition that includes it. `isCollectionInExternalCustody` is item-aware, so internal moves succeed and the loan guard does not. The partial-return test never tries a later install or loan.
- **Fix:** Treat an item as occupying only when its own custody is not `returned` (legacy rows with no `custodyStatus` may still use a non-empty `conditionIn`). Parent loan status can stay `dispatched`.

## Blocker — Loan-linked transit receipt can cite the wrong movement

- **Ticket:** MUS-633, interaction with MUS-629
- **Where:** `packages/backend/convex/utils/transitPhysicalHandoff.ts:99` and `:127`; `packages/backend/convex/transit.ts:1732`
- **Scenario:** For a return shipment with a `loanId`, receipt calls `receiveLoanItemsWithEvidence` and then stores whichever `locationHistory` row has the newest `movedAt`. An incoming return archives the object and does not write a movement (`loanCustody.ts:330`). The receipt id becomes the object's previous gallery move, while `receiptDestinationLocationId` is the location the caller sent. If that object has no location history, the query finds nothing, throws, and rolls back the lender exit, so the receipt cannot be recorded at all. An outgoing return that does not change location (`moveCollectionToLocation` returns null when the object is already at the destination) has the same false link. This path also drops `observedFromLocationId`, so a caller can attest the wrong source and still succeed. Return shipments skip the condition requirement (`transit.ts:1732`), and the loan helper then stores the literal `"Returned"` when no condition was sent. Tests cover a happy-path outgoing receipt with real condition text; they do not cover an incoming return shipment or a no-op destination.
- **Fix:** Drive the loan return through the shared movement command with `kind: "loan_return"` or `transit_receipt`, the observed source, and `transitItemId`. Persist that returned id. If the command does not create a row, fail the receipt instead of scanning history. Require accepted assessment or real condition text for incoming and outgoing receipts.

## Should-fix — Return invents condition text

- **Ticket:** MUS-629
- **Where:** `packages/backend/convex/utils/loanCustody.ts:275`
- **Scenario:** A receipt with no `conditionIn` and no accepted assessment stores `conditionIn: "Returned"`. `loans.test.ts` expects that string. The item then counts as returned because of the text as well as `custodyStatus`, which is the coupling MUS-629 said to remove. A later reader cannot tell a real condition note from this default. Dispatch and return also never set `movementKind` to `loan_dispatch` or `loan_return` (`loanCustody.ts:101` and `:308`), so location history does not show the departure: dispatch only clears `currentLocationId`, and the last history row still names the gallery.
- **Fix:** Reject the return until the caller supplies an accepted assessment or a non-empty condition note. Record `loan_dispatch` when the object leaves, including the origin as `fromLocationId`, and record `loan_return` on the way back. Keep the legacy `conditionIn` fallback only for rows that have no `custodyStatus`.

## Should-fix — Incoming lender exit does not release the location

- **Ticket:** MUS-629
- **Where:** `packages/backend/convex/utils/loanCustody.ts:199`
- **Scenario:** Staff return an incoming item without dispatching it first (`returnLoan` allows `active` → `returned`). The helper writes a `loanCustodyExits` row and archives the collection, and it leaves `currentLocationId` set. Capacity counts every collection at that location and does not filter archived rows (`locationIntegrity.ts:173`), so the departed object still fills the shelf. The exit row does not record the location either. The incoming test dispatches first, which clears the location earlier, so this path is untested. The same helper also does not look at exhibition participation, so an installed object can be archived while its exhibition row stays `installed`.
- **Fix:** On lender exit, clear the location in the same transaction and write a movement whose `fromLocationId` is the last on-site place. Refuse the exit while an exhibition participant row is `installed` or `deinstalled` without a return exception.

## Should-fix — Group add, remove, and backfill can mint a second primary

- **Ticket:** MUS-631
- **Where:** `packages/backend/convex/collectionGroups.ts:539`, `:608`, and `:886`
- **Scenario:** `addItems` sets `role: "primary"` when `collections.collectionGroupId` equals that group, and it does not look for an existing primary membership. An object whose pointer is group B and whose membership primary is group A gains a second primary when B is added. `removeItems` blocks only when the pointer matches, so a membership with `role: "primary"` and a different pointer is deleted. `backfillMemberships` records `conflicting_primary` and still continues: it inserts the pointer as `primary` when that row is missing, and it fills empty roles with `primary` when they match the pointer. A conflict report and a second explicit primary are written in one run. Tests cover the happy path and conflict reporting, not these writes.
- **Fix:** On conflict, leave that object's memberships unchanged. Add and remove should update roles only through `syncCollectionGroupMemberships`, and removal of a `primary` row should require a new primary in the same call.

## Should-fix — In-flight transfers skip the observed-source check

- **Ticket:** MUS-635
- **Where:** `packages/backend/convex/utils/institutionTransferEvidence.ts:34`; `packages/backend/convex/objectMoves.ts:1890`
- **Scenario:** `assertObservedSourceLocationMatches` returns immediately when `approvedSourceLocationId` is `undefined`. Approve now stores the field, but a request already in `awaiting_acceptance` before this deploy has no value. Target accept then moves the object even if it left the shelf after source approval. New requests are covered by `objectMoves.test.ts`; in-flight rows are not.
- **Fix:** If the field is missing, bind it once from the object's location at accept time and compare, or reject accept until the source organization re-approves. Do not treat "field absent" as "no conflict".

## Should-fix — Exhibition return always claims the original location

- **Ticket:** MUS-632
- **Where:** `packages/backend/convex/utils/exhibitionObjectLocation.ts:331`
- **Scenario:** Return accepts `overrideLocationId` and moves the object there, then patches `returnedToOriginalLocation: true` even when that id is not `originalLocationId`. A return to the conservation lab is stored as a return home. The handoff summary does not show the flag, but any later report that trusts it will disagree with `currentLocationId` and `returnMovementId`.
- **Fix:** Set the flag only when the destination equals `originalLocationId`.

## Minor — Executed transfer accept succeeds before the permission check

- **Ticket:** MUS-635
- **Where:** `packages/backend/convex/objectMoves.ts:1859`
- **Scenario:** `accept` returns `null` for `status === "executed"` before `requirePermission`. An authenticated user who is not in the target organization, and who has the request id, gets the same success as an idempotent retry. A request in any other status still fails the permission check or returns `Move request is already <status>`, so the silent success confirms that this request completed.
- **Fix:** Require target `organization.manage_settings` before the executed short-circuit. Keep the short-circuit so a second accept does not write another custody event.

## Minor — Condition comparison drops the previous accepted assessment

- **Ticket:** MUS-627
- **Where:** `packages/backend/convex/conditionAssessments.ts:185`
- **Scenario:** `getForObject` loads 25 assessments by creation time and treats the second accepted row in that window as the previous one. Accept assessment A, create 24 drafts, accept assessment B. Comparison `previousAccepted` is null even though A is still in the retained history. `listForObject` can still page to A, so the history is not destroyed, but the comparison the Physical tab shows is wrong. The focused tests use two accepts with no drafts between them.
- **Fix:** Query accepted assessments with a status-aware index, or walk the collection index until two accepted rows are found, and order the comparison by `acceptedAt`.

## Verdict

Four blockers. Do not merge until exhibition close and activation cannot skip outcomes, cancelled and partially returned loans release item custody, and a loan-linked transit receipt stores the movement it actually wrote. The should-fix items are real custody and membership mistakes with the same kind of user-visible failure, and they should land in this batch or as an immediate follow-up before production backfill and loan use.
