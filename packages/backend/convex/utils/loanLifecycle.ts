import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { requireLoansAccess } from "./loanAccess";
import { isLoanItemDispatched, isLoanItemReturned } from "./loanItemState";
import {
  dispatchLoanItems,
  type ReceiveLoanItemInput,
  restoreLoanCollections,
  returnLoanItems,
} from "./loanMovement";
import { assertAllowedLoanTransition } from "./loanStatusTransitions";
import {
  logActionAndGetRecipients,
  notifyOrganizationRecipients,
} from "./organizationAudit";
import { requirePermission } from "./permissions";

export async function returnLoanHandler(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    conditionIn?: string;
    loanItemIds?: Array<Id<"loanItems">>;
    receipts?: ReceiveLoanItemInput[];
  },
) {
  const [userId, loan] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.loanId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!loan) {
    throw new Error("Loan not found");
  }

  assertAllowedLoanTransition(
    loan.status,
    "returned",
    "Loan must be active or dispatched to return",
  );

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.update"),
  ]);

  const movement = await returnLoanItems(ctx, {
    loanId: args.loanId,
    organizationId: loan.organizationId,
    changedBy: userId,
    conditionIn: args.conditionIn,
    selectedLoanItemIds: args.loanItemIds,
    receipts: args.receipts,
  });

  if (movement.nextLoanStatus !== loan.status) {
    await ctx.db.patch(args.loanId, { status: movement.nextLoanStatus });
  }

  if (movement.allItemsNowReturned) {
    const [, recipients] = await Promise.all([
      Promise.resolve(),
      logActionAndGetRecipients(ctx, {
        organizationId: loan.organizationId,
        userId,
        action: "returned",
        entityType: "loan",
        entityId: args.loanId,
        changes: {
          status: "returned",
          itemsReturned: movement.returnedItemCount,
          returnedItemIds: movement.returnedItemIds,
        },
      }),
    ] as const);

    await notifyOrganizationRecipients(ctx, recipients, {
      organizationId: loan.organizationId,
      userId,
      type: "loan_returned",
      title: "Loan Returned",
      message: `Loan ${loan.loanNumber} has been returned.`,
      relatedEntityType: "loan",
      relatedEntityId: args.loanId,
    });
  } else {
    const recipients = await logActionAndGetRecipients(ctx, {
      organizationId: loan.organizationId,
      userId,
      action: "items_returned",
      entityType: "loan",
      entityId: args.loanId,
      changes: {
        itemsReturned: movement.returnedItemCount,
        totalItems: movement.totalItemCount,
        returnedItemIds: movement.returnedItemIds,
      },
    });

    await notifyOrganizationRecipients(ctx, recipients, {
      organizationId: loan.organizationId,
      userId,
      type: "loan_partial_return",
      title: "Loan Items Returned",
      message: `${movement.returnedItemCount} of ${movement.totalItemCount} items from loan ${loan.loanNumber} have been returned.`,
      relatedEntityType: "loan",
      relatedEntityId: args.loanId,
    });
  }

  return null;
}

export async function dispatchLoanHandler(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    loanItemIds?: Array<Id<"loanItems">>;
    itemAssessments?: Record<string, Id<"conditionAssessments">>;
  },
) {
  const [userId, loan] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.loanId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!loan) {
    throw new Error("Loan not found");
  }

  assertAllowedLoanTransition(
    loan.status,
    "dispatched",
    "Loan must be active to dispatch",
  );

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.update"),
  ]);

  const dispatchResult = await dispatchLoanItems(ctx, {
    loanId: args.loanId,
    changedBy: userId,
    selectedLoanItemIds: args.loanItemIds,
    itemAssessments: args.itemAssessments,
  });

  const [, recipients] = await Promise.all([
    Promise.resolve(),
    logActionAndGetRecipients(ctx, {
      organizationId: loan.organizationId,
      userId,
      action: "dispatched",
      entityType: "loan",
      entityId: args.loanId,
      changes: {
        status: dispatchResult.loanStatus,
        dispatchedItemIds: dispatchResult.dispatchedItemIds,
      },
    }),
  ] as const);

  await notifyOrganizationRecipients(ctx, recipients, {
    organizationId: loan.organizationId,
    userId,
    type: "loan_dispatched",
    title: "Loan Dispatched",
    message: `Loan ${loan.loanNumber} has been dispatched.`,
    relatedEntityType: "loan",
    relatedEntityId: args.loanId,
  });

  return null;
}

export async function cancelLoanHandler(
  ctx: MutationCtx,
  args: { loanId: Id<"loans"> },
) {
  const [userId, loan] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.loanId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!loan) {
    throw new Error("Loan not found");
  }

  assertAllowedLoanTransition(
    loan.status,
    "cancelled",
    "Can only cancel pending, active, or dispatched loans",
  );

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.update"),
  ]);

  const loanItems = await ctx.db
    .query("loanItems")
    .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
    .collect();
  const dispatchedItems = loanItems.filter(
    (item) =>
      !isLoanItemReturned(item) && isLoanItemDispatched(item, loan.status),
  );
  if (dispatchedItems.length > 0) {
    throw new Error(
      "Cannot cancel a loan after an item has been dispatched; record its return first",
    );
  }

  const [, recipients] = await Promise.all([
    Promise.all([
      ctx.db.patch(args.loanId, {
        status: "cancelled",
      }),
      restoreLoanCollections(ctx, {
        loanId: args.loanId,
        changedBy: userId,
      }),
    ]),
    logActionAndGetRecipients(ctx, {
      organizationId: loan.organizationId,
      userId,
      action: "cancelled",
      entityType: "loan",
      entityId: args.loanId,
      changes: { status: "cancelled" },
    }),
  ] as const);

  await notifyOrganizationRecipients(ctx, recipients, {
    organizationId: loan.organizationId,
    userId,
    type: "loan_cancelled",
    title: "Loan Cancelled",
    message: `Loan ${loan.loanNumber} has been cancelled.`,
    relatedEntityType: "loan",
    relatedEntityId: args.loanId,
  });

  return null;
}

export async function returnLoanItemHandler(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    collectionId: Id<"collections">;
    conditionIn?: string;
    notes?: string;
    destinationLocationId?: Id<"locations">;
    confirmReturnToOrigin?: boolean;
    incomingConditionAssessmentId?: Id<"conditionAssessments">;
  },
) {
  const [userId, loan] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.loanId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!loan) {
    throw new Error("Loan not found");
  }

  if (loan.status !== "active" && loan.status !== "dispatched") {
    throw new Error("Loan is not open for returns");
  }

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.update"),
  ]);

  const loanItem = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
    .filter((q) => q.eq(q.field("loanId"), args.loanId))
    .first();

  if (!loanItem) {
    throw new Error("Item not found in this loan");
  }

  await returnLoanHandler(ctx, {
    loanId: args.loanId,
    loanItemIds: [loanItem._id],
    receipts: [
      {
        loanItemId: loanItem._id,
        destinationLocationId: args.destinationLocationId,
        confirmReturnToOrigin: args.confirmReturnToOrigin,
        incomingConditionAssessmentId: args.incomingConditionAssessmentId,
        conditionIn: args.conditionIn,
        notes: args.notes,
      },
    ],
  });

  return null;
}
