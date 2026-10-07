import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  markCollectionActive,
  markCollectionLoaned,
} from "./collectionLifecycle";
import {
  allLoanItemsReturned,
  isLoanItemReturned,
  reconcileLoanStatusFromItems,
} from "./loanItemState";
import { moveCollectionToLocation } from "./locationIntegrity";

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
    throw new Error("Condition assessment not found");
  }
  if (
    assessment.collectionId !== collectionId ||
    assessment.organizationId !== organizationId
  ) {
    throw new Error("Condition assessment does not belong to this object");
  }
  if (assessment.status !== "accepted") {
    throw new Error("Condition assessment must be accepted before linking");
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
    throw new Error("No items available to dispatch");
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
        clearLocation: true,
      });

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
}

async function resolveReturnDestination(
  ctx: MutationCtx,
  item: LoanItem,
  loan: Doc<"loans">,
  input: ReceiveLoanItemInput,
): Promise<Id<"locations">> {
  if (loan.type === "incoming") {
    throw new Error("Incoming loan items use lender exit, not internal location");
  }

  if (input.destinationLocationId) {
    const location = await ctx.db.get(input.destinationLocationId);
    if (!location || location.organizationId !== loan.organizationId) {
      throw new Error("Return destination not found in this organization");
    }
    return input.destinationLocationId;
  }

  if (input.confirmReturnToOrigin && item.dispatchOriginLocationId) {
    return item.dispatchOriginLocationId;
  }

  if (item.dispatchOriginLocationId && !item.dispatchOriginUnknown) {
    throw new Error(
      "Confirm return to recorded origin or choose a different destination",
    );
  }

  throw new Error("Return destination is required");
}

async function recordIncomingLenderExit(
  ctx: MutationCtx,
  {
    changedBy,
    collectionId,
    item,
    loan,
    notes,
  }: {
    loan: Doc<"loans">;
    item: LoanItem;
    collectionId: Id<"collections">;
    changedBy: Id<"users">;
    notes?: string;
  },
) {
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
    notes,
  });

  const collection = await ctx.db.get(collectionId);
  if (collection && collection.status !== "archived") {
    await ctx.db.patch(collectionId, {
      status: "archived",
      archivedAt: Date.now(),
      archivedBy: changedBy,
      archivedReason: `Returned to lender: ${loan.lenderBorrowerName}`,
      lastModifiedBy: changedBy,
      lastModifiedAt: Date.now(),
    });
  }

  return exitId;
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
    throw new Error("No items selected to return");
  }

  const returnedAt = Date.now();
  const returnedItemIds: Id<"loanItems">[] = [];

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

    let conditionInValue =
      receipt?.conditionIn ?? conditionIn ?? item.conditionIn;
    if (
      conditionInValue === undefined &&
      incomingAssessmentId === undefined
    ) {
      conditionInValue = "Returned";
    }
    if (
      incomingAssessmentId === undefined &&
      (conditionInValue === undefined ||
        String(conditionInValue).trim().length === 0)
    ) {
      throw new Error("Return condition evidence is required");
    }

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

      await moveCollectionToLocation(
        ctx,
        { ...collection, status: "active" },
        destinationLocationId,
        changedBy,
        `Loan ${loan.loanNumber} return`,
        { notes: receipt?.notes },
      );

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
      const exitId = await recordIncomingLenderExit(ctx, {
        loan,
        item,
        collectionId: item.collectionId,
        changedBy,
        notes: receipt?.notes,
      });

      await ctx.db.patch(item._id, {
        custodyStatus: "returned",
        returnedAt,
        returnedBy: changedBy,
        incomingConditionAssessmentId: incomingAssessmentId,
        conditionIn: conditionInValue,
        lenderExitId: exitId,
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
    returnedItemCount: returnedItemIds.length,
    totalItemCount: allLoanItems.length,
    nextLoanStatus: allReturned
      ? ("returned" as const)
      : reconcileLoanStatusFromItems(updatedLoanItems, loan.status),
  };
}
