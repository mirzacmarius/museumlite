import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  markCollectionActive,
  markCollectionDeaccessioned,
} from "./collectionLifecycle";
import {
  dispatchLoanItems,
  restoreLoanCollections,
  returnLoanItems,
} from "./loanMovement";
import { requireLoansAccess } from "./loanAccess";
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
    throw new Error("Loan must be active or dispatched to return");
  }

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
  });

  if (movement.allItemsNowReturned) {
    const [, recipients] = await Promise.all([
      ctx.db.patch(args.loanId, {
        status: "returned",
      }),
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

  if (loan.status !== "active") {
    throw new Error("Loan must be active to dispatch");
  }

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.update"),
  ]);

  await Promise.all([
    dispatchLoanItems(ctx, {
      loanId: args.loanId,
      changedBy: userId,
    }),
    ctx.db.patch(args.loanId, {
      status: "dispatched",
    }),
  ]);

  const recipients = await logActionAndGetRecipients(ctx, {
    organizationId: loan.organizationId,
    userId,
    action: "dispatched",
    entityType: "loan",
    entityId: args.loanId,
    changes: { status: "dispatched" },
  });

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

  if (
    loan.status !== "pending" &&
    loan.status !== "active" &&
    loan.status !== "dispatched"
  ) {
    throw new Error("Can only cancel pending, active, or dispatched loans");
  }

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.update"),
  ]);

  await Promise.all([
    ctx.db.patch(args.loanId, {
      status: "cancelled",
    }),
    restoreLoanCollections(ctx, {
      loanId: args.loanId,
      changedBy: userId,
    }),
  ]);

  const recipients = await logActionAndGetRecipients(ctx, {
    organizationId: loan.organizationId,
    userId,
    action: "cancelled",
    entityType: "loan",
    entityId: args.loanId,
    changes: { status: "cancelled" },
  });

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

  if (loan.status !== "active") {
    throw new Error("Loan is not active");
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

  await ctx.db.patch(loanItem._id, {
    conditionIn: args.conditionIn,
    notes: args.notes
      ? loanItem.notes
        ? `${loanItem.notes}\n${args.notes}`
        : args.notes
      : loanItem.notes,
  });

  if (loan.type === "incoming") {
    const collection = await ctx.db.get(args.collectionId);
    if (collection) {
      if (collection.status !== "deaccessioned") {
        await ctx.db.insert("deaccessions", {
          organizationId: loan.organizationId,
          collectionId: args.collectionId,
          deaccessionNumber: `RET-${collection.accessionNumber}`,
          dateDeaccessioned: Date.now(),
          reason: "Returned to lender",
          method: "transfer",
          disposition: `Returned to ${loan.lenderBorrowerName}`,
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowStep: 0,
        });

        await markCollectionDeaccessioned(ctx, {
          collectionId: args.collectionId,
          changedBy: userId,
        });
      }
    }
  } else {
    await markCollectionActive(ctx, {
      collectionId: args.collectionId,
      changedBy: userId,
    });
  }

  return null;
}
