import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { markCollectionActive } from "./collectionLifecycle";
import {
  dispatchLoanItemsWithEvidence,
  receiveLoanItemsWithEvidence,
  type ReceiveLoanItemInput,
} from "./loanCustody";
import { allLoanItemsReturned } from "./loanItemState";

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
    selectedLoanItemIds,
    itemAssessments,
  }: {
    loanId: Id<"loans">;
    changedBy: Id<"users">;
    selectedLoanItemIds?: Id<"loanItems">[];
    itemAssessments?: Record<string, Id<"conditionAssessments">>;
  },
) {
  const loan = await ctx.db.get(loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  return await dispatchLoanItemsWithEvidence(ctx, {
    loanId,
    loan,
    changedBy,
    selectedLoanItemIds,
    itemAssessments,
  });
}

export async function returnLoanItems(
  ctx: MutationCtx,
  {
    changedBy,
    conditionIn,
    loanId,
    organizationId,
    receipts,
    selectedLoanItemIds,
  }: {
    loanId: Id<"loans">;
    organizationId: Id<"organizations">;
    changedBy: Id<"users">;
    conditionIn?: string;
    selectedLoanItemIds?: Id<"loanItems">[];
    receipts?: ReceiveLoanItemInput[];
  },
) {
  const loan = await ctx.db.get(loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  return await receiveLoanItemsWithEvidence(ctx, {
    loanId,
    organizationId,
    loan,
    changedBy,
    conditionIn,
    selectedLoanItemIds,
    receipts,
  });
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

  await Promise.all(
    Array.from(loanItems).map(async (item) => {
      await markCollectionActive(ctx, {
        collectionId: item.collectionId,
        changedBy,
      });
    }),
  );

  return {
    restoredItemIds: loanItems.map((item) => item._id),
  };
}

export type { ReceiveLoanItemInput };

export { allLoanItemsReturned };
