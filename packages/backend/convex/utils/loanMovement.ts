import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  markCollectionActive,
  markCollectionLoaned,
} from "./collectionLifecycle";

type LoanItem = Doc<"loanItems">;

async function getLoanItems(ctx: MutationCtx, loanId: Id<"loans">) {
  return await ctx.db
    .query("loanItems")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .collect();
}

export async function dispatchLoanItems(
  ctx: MutationCtx,
  {
    changedBy,
    loanId,
  }: {
    loanId: Id<"loans">;
    changedBy: Id<"users">;
  },
) {
  const loanItems = await getLoanItems(ctx, loanId);

  await Promise.all(
    loanItems.map((item) =>
      markCollectionLoaned(ctx, {
        collectionId: item.collectionId,
        changedBy,
        clearLocation: true,
      }),
    ),
  );

  return {
    dispatchedItemIds: loanItems.map((item) => item._id),
  };
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

export async function returnLoanItems(
  ctx: MutationCtx,
  {
    changedBy,
    conditionIn,
    loanId,
    organizationId,
    selectedLoanItemIds,
  }: {
    loanId: Id<"loans">;
    organizationId: Id<"organizations">;
    changedBy: Id<"users">;
    conditionIn?: string;
    selectedLoanItemIds?: Id<"loanItems">[];
  },
) {
  const allLoanItems = await getLoanItems(ctx, loanId);
  const itemsToReturn = selectLoanItems(allLoanItems, selectedLoanItemIds);

  if (itemsToReturn.length === 0) {
    throw new Error("No items selected to return");
  }

  const returnedItemIds: Id<"loanItems">[] = [];
  for (const item of itemsToReturn) {
    await markCollectionActive(ctx, {
      collectionId: item.collectionId,
      changedBy,
    });

    const conditionInValue = conditionIn || item.conditionIn || "Returned";
    await ctx.db.patch(item._id, {
      conditionIn: conditionInValue,
    });

    returnedItemIds.push(item._id);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId: changedBy,
      action: "item_returned",
      entityType: "loanItem",
      entityId: item._id,
      changes: {
        loanId,
        collectionId: item.collectionId,
        conditionIn: conditionInValue,
      },
    });
  }

  const updatedLoanItems = await getLoanItems(ctx, loanId);
  const allItemsNowReturned = updatedLoanItems.every(
    (item) =>
      item.conditionIn != null && String(item.conditionIn).trim().length > 0,
  );

  return {
    allItemsNowReturned,
    returnedItemIds,
    returnedItemCount: returnedItemIds.length,
    totalItemCount: allLoanItems.length,
  };
}

export async function restoreLoanCollections(
  ctx: MutationCtx,
  {
    changedBy,
    loanId,
  }: {
    loanId: Id<"loans">;
    changedBy: Id<"users">;
  },
) {
  const loanItems = await getLoanItems(ctx, loanId);

  for (const item of loanItems) {
    await markCollectionActive(ctx, {
      collectionId: item.collectionId,
      changedBy,
    });
  }

  return {
    restoredItemIds: loanItems.map((item) => item._id),
  };
}
