# A transfer's stage is worked out when it is read, and the sender can cancel until the receiver decides

MUS-846. A transfer to another Organization stores one of seven statuses. Two of them, `pending` and `approved_for_transfer`, are left from earlier versions, and an `awaiting_acceptance` row approved before the sender's Location was recorded (no `approvedSourceLocationId`) cannot be accepted. The Transfers board, the Accessions tab count, the Work board, the transfer page's badge and its buttons each worked out the stage and who acts next on their own, and they disagreed on these rows: the page offered the receiver an Accept that failed and gave the sender no Approve. Once the sender approved, only the receiver could end the transfer, while the Object was out of the sender's catalog.

`utils/transferStages.ts` now decides both, each time a transfer is read:

- A transfer is waiting for the sender, waiting for the receiver, received, declined or cancelled. `pending`, `pending_source_approval`, `approved_for_transfer` and an `awaiting_acceptance` row without an observed source Location wait for the sender. The last two are approvals to make again, and the board and the transfer page say so. No row is migrated.
- Every transfer query returns the stage, and every decision checks it. The receiver cannot accept or decline a transfer that waits for the sender (`TRANSFER_AWAITS_SENDER`). The transfer page offers the sender Approve and Cancel; as before, the API also lets the sender's administrators decline a request they have not approved. One they approved before they approve again, which keeps its Removal and its notes, or cancel.
- The backend lists what the viewer may do from their memberships in both Organizations, each action with the Organization it acts for, instead of the app deciding from the Organization selected. Transfers stay with each side's administrators, and the requester may cancel their own request until the sender approves it.
- The sender's administrators may cancel until the receiver decides. Cancelling after approval rejects the transfer's Removal, as the receiver's decline does (ADR 0019), so the Object is free for another Removal or transfer. The receiver's administrators are notified. A transfer cancelled before it reached the receiver, including an earlier approval waiting to be made again, stays off the receiver's board.
- The board's counts and the Transfers tab count come from `objectMoves.getBoardCounts`, so the app no longer reads every transfer to count them, and the counts do not change with the board's search.

Considered and rejected:

- Migrating old rows to the current statuses, because reading them as a stage covers every row as it is, and a migration would need a production count first. Dropping `pending` and `approved_for_transfer` from the schema can follow once production holds none.
- Letting the sender decline after approving, because cancelling already stops the transfer, and declining is the receiver's answer.
- Counting transfers by stage on the Dashboard in the same change, because its projection counts stored statuses and needs a rebuild (MUS-849).
