import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  markCollectionActive,
  markCollectionLoaned,
} from "./collectionLifecycle";
import { custodyConflict } from "./custodyErrors";
import {
  allLoanItemsReturned,
  isLoanItemReturned,
  reconcileLoanStatusFromItems,
} from "./loanItemState";
import {
  moveCollectionToLocation,
  recordCustodyDeparture,
  visibleLocationName,
} from "./locationIntegrity";
import type { MovementKind } from "./movementValidators";

type LoanItem = Doc<"loanItems">;

async function getLoanItems(ctx: MutationCtx, loanId: Id<"loans">) {
  return await ctx.db
    .query("loanItems")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .collect();
}

function selectLoanItems(
  allLoanItems: LoanItem[],
  selectedLoanItemIds: Id<"loanItems">[] | undefined,
) {
  if (!selectedLoanItemIds) {
    return allLoanItems;
  }
  const selected = new Set(selectedLoanItemIds);
  return allLoanItems.filter((item) => selected.has(item._id));
}

async function assertAcceptedAssessment(
  ctx: MutationCtx,
  assessmentId: Id<"conditionAssessments">,
  collectionId: Id<"collections">,
  organizationId: Id<"organizations">,
) {
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment) {
    throw custodyConflict(
      "REFERENCE_NOT_FOUND",
      "Condition assessment not found",
    );
  }
  if (
    assessment.collectionId !== collectionId ||
    assessment.organizationId !== organizationId
  ) {
    throw custodyConflict(
      "REFERENCE_NOT_FOUND",
      "Condition assessment does not belong to this object",
    );
  }
  if (assessment.status !== "accepted") {
    throw custodyConflict(
      "ASSESSMENT_NOT_ACCEPTED",
      "Condition assessment must be accepted before linking",
    );
  }
  return assessment;
}

export async function dispatchLoanItemsWithEvidence(
  ctx: MutationCtx,
  {
    changedBy,
    loan,
    loanId,
    selectedLoanItemIds,
    itemAssessments,
  }: {
    loanId: Id<"loans">;
    loan: Doc<"loans">;
    changedBy: Id<"users">;
    selectedLoanItemIds?: Id<"loanItems">[];
    itemAssessments?: Record<string, Id<"conditionAssessments">>;
  },
) {
  const allItems = await getLoanItems(ctx, loanId);
  const itemsToDispatch = selectLoanItems(allItems, selectedLoanItemIds).filter(
    (item) => !isLoanItemReturned(item) && item.custodyStatus !== "dispatched",
  );

  if (itemsToDispatch.length === 0) {
    throw custodyConflict(
      "HANDOFF_ALREADY_RECORDED",
      "No items available to dispatch",
    );
  }

  const dispatchedAt = Date.now();
  await Promise.all(
    itemsToDispatch.map(async (item) => {
      const collection = await ctx.db.get(item.collectionId);
      if (!collection) {
        throw new Error(`Collection ${item.collectionId} not found`);
      }

      const originLocationId = collection.currentLocationId;
      const assessmentId = itemAssessments?.[item._id];
      if (assessmentId) {
        await assertAcceptedAssessment(
          ctx,
          assessmentId,
          item.collectionId,
          loan.organizationId,
        );
      }

      await markCollectionLoaned(ctx, {
        collectionId: item.collectionId,
        changedBy,
      });
      if (originLocationId) {
        await recordCustodyDeparture(
          ctx,
          collection,
          changedBy,
          `Loan ${loan.loanNumber} dispatch`,
          {
            kind: "loan_dispatch",
            fromLocationId: originLocationId,
          },
        );
      }

      await ctx.db.patch(item._id, {
        custodyStatus: "dispatched",
        dispatchOriginLocationId: originLocationId,
        dispatchOriginUnknown: originLocationId === undefined,
        dispatchedAt,
        dispatchedBy: changedBy,
        outgoingConditionAssessmentId: assessmentId,
      });
    }),
  );

  const refreshedItems = await getLoanItems(ctx, loanId);
  const nextStatus = reconcileLoanStatusFromItems(refreshedItems, loan.status);
  if (nextStatus !== loan.status) {
    await ctx.db.patch(loanId, { status: nextStatus });
  }

  return {
    dispatchedItemIds: itemsToDispatch.map((item) => item._id),
    loanStatus: nextStatus,
  };
}

export interface ReceiveLoanItemInput {
  loanItemId: Id<"loanItems">;
  destinationLocationId?: Id<"locations">;
  confirmReturnToOrigin?: boolean;
  incomingConditionAssessmentId?: Id<"conditionAssessments">;
  conditionIn?: string;
  notes?: string;
  observedFromLocationId?: Id<"locations"> | null;
  transitItemId?: Id<"transitItems">;
  movementKind?: Extract<MovementKind, "loan_return" | "transit_receipt">;
}

async function resolveReturnDestination(
  ctx: MutationCtx,
  item: LoanItem,
  loan: Doc<"loans">,
  input: ReceiveLoanItemInput,
): Promise<Id<"locations">> {
  if (loan.type === "incoming") {
    throw new Error(
      "Incoming loan items use lender exit, not internal location",
    );
  }

  if (input.destinationLocationId) {
    const location = await ctx.db.get(input.destinationLocationId);
    if (!location || location.organizationId !== loan.organizationId) {
      throw custodyConflict(
        "REFERENCE_NOT_FOUND",
        "Return destination not found in this organization",
      );
    }
    return input.destinationLocationId;
  }

  if (input.confirmReturnToOrigin && item.dispatchOriginLocationId) {
    return item.dispatchOriginLocationId;
  }

  if (item.dispatchOriginLocationId && !item.dispatchOriginUnknown) {
    throw custodyConflict(
      "DESTINATION_REQUIRED",
      "Confirm return to recorded origin or choose a different destination",
    );
  }

  throw custodyConflict(
    "DESTINATION_REQUIRED",
    "Return destination is required",
  );
}

/**
 * Refuses a custody exit while the object is installed on, or not yet back
 * from, an exhibition without a recorded return exception.
 */
export async function assertExitNotBlockedByExhibition(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  message = "Cannot return an object to the lender while its exhibition outcome is unresolved",
) {
  const participants = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  const blocking = participants.find(
    (participant) =>
      (participant.status === "installed" ||
        participant.status === "deinstalled") &&
      participant.returnException === undefined,
  );
  if (blocking) {
    throw custodyConflict("EXHIBITION_OUTCOME_UNRESOLVED", message);
  }
}

export function observedSourceMatches(
  observedFromLocationId: Id<"locations"> | null | undefined,
  currentLocationId: Id<"locations"> | undefined,
) {
  if (observedFromLocationId === undefined) return true;
  return observedFromLocationId === (currentLocationId ?? null);
}

async function recordIncomingLenderExit(
  ctx: MutationCtx,
  {
    changedBy,
    collectionId,
    item,
    loan,
    movementKind,
    notes,
    observedFromLocationId,
    transitItemId,
  }: {
    loan: Doc<"loans">;
    item: LoanItem;
    collectionId: Id<"collections">;
    changedBy: Id<"users">;
    notes?: string;
    observedFromLocationId?: Id<"locations"> | null;
    transitItemId?: Id<"transitItems">;
    movementKind?: Extract<MovementKind, "loan_return" | "transit_receipt">;
  },
) {
  await assertExitNotBlockedByExhibition(ctx, collectionId);
  const collection = await ctx.db.get(collectionId);
  if (
    !observedSourceMatches(
      observedFromLocationId,
      collection?.currentLocationId,
    )
  ) {
    const current = collection?.currentLocationId
      ? await ctx.db.get(collection.currentLocationId)
      : null;
    throw custodyConflict(
      "SOURCE_CHANGED",
      "Object is not at the source observed for this lender exit",
      {
        currentLocationName: visibleLocationName(current, loan.organizationId),
      },
    );
  }

  const fromLocationId =
    collection?.currentLocationId ?? item.dispatchOriginLocationId;
  const movementId =
    collection && fromLocationId
      ? await recordCustodyDeparture(
          ctx,
          collection,
          changedBy,
          `Loan ${loan.loanNumber} return to lender`,
          {
            kind: movementKind ?? "loan_return",
            fromLocationId,
            transitItemId,
            notes,
          },
        )
      : null;
  if (transitItemId && !movementId) {
    throw new Error("Loan return did not record movement history");
  }

  const exitId = await ctx.db.insert("loanCustodyExits", {
    organizationId: loan.organizationId,
    loanId: loan._id,
    loanItemId: item._id,
    collectionId,
    exitType: "return_to_lender",
    recipientName: loan.lenderBorrowerName,
    accountId: loan.accountId,
    recordedBy: changedBy,
    recordedAt: Date.now(),
    fromLocationId,
    notes,
  });

  if (collection && collection.status !== "archived") {
    await ctx.db.patch(collectionId, {
      status: "archived",
      currentLocationId: undefined,
      archivedAt: Date.now(),
      archivedBy: changedBy,
      archivedReason: `Returned to lender: ${loan.lenderBorrowerName}`,
      lastModifiedBy: changedBy,
      lastModifiedAt: Date.now(),
    });
  }

  return { exitId, movementId };
}

export async function receiveLoanItemsWithEvidence(
  ctx: MutationCtx,
  {
    changedBy,
    conditionIn,
    loan,
    loanId,
    organizationId,
    receipts,
    selectedLoanItemIds,
  }: {
    loanId: Id<"loans">;
    organizationId: Id<"organizations">;
    loan: Doc<"loans">;
    changedBy: Id<"users">;
    conditionIn?: string;
    selectedLoanItemIds?: Id<"loanItems">[];
    receipts?: ReceiveLoanItemInput[];
  },
) {
  const allLoanItems = await getLoanItems(ctx, loanId);
  const receiptByItemId = new Map(
    (receipts ?? []).map((receipt) => [receipt.loanItemId, receipt]),
  );

  let itemsToReturn = selectLoanItems(allLoanItems, selectedLoanItemIds).filter(
    (item) => !isLoanItemReturned(item),
  );

  if (receipts && receipts.length > 0) {
    const receiptIds = new Set(receipts.map((receipt) => receipt.loanItemId));
    itemsToReturn = itemsToReturn.filter((item) => receiptIds.has(item._id));
  }

  if (itemsToReturn.length === 0) {
    throw custodyConflict(
      "HANDOFF_ALREADY_RECORDED",
      "No items selected to return",
    );
  }

  const returnedAt = Date.now();
  const returnedItemIds: Id<"loanItems">[] = [];
  const movementIds: Id<"locationHistory">[] = [];

  for (const item of itemsToReturn) {
    let receipt = receiptByItemId.get(item._id);
    if (!receipt && loan.type === "outgoing") {
      if (item.dispatchOriginLocationId && !item.dispatchOriginUnknown) {
        receipt = {
          loanItemId: item._id,
          confirmReturnToOrigin: true,
        };
      }
    }
    const incomingAssessmentId = receipt?.incomingConditionAssessmentId;
    if (incomingAssessmentId) {
      await assertAcceptedAssessment(
        ctx,
        incomingAssessmentId,
        item.collectionId,
        organizationId,
      );
    }

    const suppliedCondition = (receipt?.conditionIn ?? conditionIn)?.trim();
    if (
      incomingAssessmentId === undefined &&
      (suppliedCondition === undefined || suppliedCondition.length === 0)
    ) {
      throw custodyConflict(
        "CONDITION_EVIDENCE_REQUIRED",
        "Return condition evidence is required",
      );
    }
    const conditionInValue =
      suppliedCondition && suppliedCondition.length > 0
        ? suppliedCondition
        : undefined;

    if (loan.type === "outgoing") {
      const destinationLocationId = await resolveReturnDestination(
        ctx,
        item,
        loan,
        receipt ?? { loanItemId: item._id },
      );
      const collection = await ctx.db.get(item.collectionId);
      if (!collection) {
        throw new Error(`Collection ${item.collectionId} not found`);
      }

      await markCollectionActive(ctx, {
        collectionId: item.collectionId,
        changedBy,
      });

      const movementId = await moveCollectionToLocation(
        ctx,
        { ...collection, status: "active" },
        destinationLocationId,
        changedBy,
        `Loan ${loan.loanNumber} return`,
        {
          kind: receipt?.movementKind ?? "loan_return",
          notes: receipt?.notes,
          expectedFromLocationId: receipt?.observedFromLocationId,
          transitItemId: receipt?.transitItemId,
          releasingExternalCustody: true,
        },
      );
      if (receipt?.transitItemId && !movementId) {
        throw new Error("Loan return did not record movement history");
      }
      if (movementId) {
        movementIds.push(movementId);
      }

      await ctx.db.patch(item._id, {
        custodyStatus: "returned",
        returnDestinationLocationId: destinationLocationId,
        returnedAt,
        returnedBy: changedBy,
        incomingConditionAssessmentId: incomingAssessmentId,
        conditionIn: conditionInValue,
        notes: receipt?.notes
          ? item.notes
            ? `${item.notes}\n${receipt.notes}`
            : receipt.notes
          : item.notes,
      });
    } else {
      const exit = await recordIncomingLenderExit(ctx, {
        loan,
        item,
        collectionId: item.collectionId,
        changedBy,
        notes: receipt?.notes,
        observedFromLocationId: receipt?.observedFromLocationId,
        transitItemId: receipt?.transitItemId,
        movementKind: receipt?.movementKind,
      });
      if (exit.movementId) {
        movementIds.push(exit.movementId);
      }

      await ctx.db.patch(item._id, {
        custodyStatus: "returned",
        returnedAt,
        returnedBy: changedBy,
        incomingConditionAssessmentId: incomingAssessmentId,
        conditionIn: conditionInValue,
        lenderExitId: exit.exitId,
        notes: receipt?.notes
          ? item.notes
            ? `${item.notes}\n${receipt.notes}`
            : receipt.notes
          : item.notes,
      });
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId: changedBy,
      action: "item_returned",
      entityType: "loanItem",
      entityId: item._id,
      changes: {
        loanId,
        collectionId: item.collectionId,
        custodyStatus: "returned",
      },
    });

    returnedItemIds.push(item._id);
  }

  const updatedLoanItems = await getLoanItems(ctx, loanId);
  const allReturned = allLoanItemsReturned(updatedLoanItems);

  return {
    allItemsNowReturned: allReturned,
    returnedItemIds,
    movementIds,
    returnedItemCount: returnedItemIds.length,
    totalItemCount: allLoanItems.length,
    nextLoanStatus: allReturned
      ? ("returned" as const)
      : reconcileLoanStatusFromItems(updatedLoanItems, loan.status),
  };
}
