import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const OCCUPYING_LOAN_STATUSES: ReadonlySet<
  Doc<"loans">["status"]
> = new Set(["pending", "active", "dispatched"]);

export async function collectionHasOccupyingLoan(
  ctx: MutationCtx | QueryCtx,
  collectionId: Id<"collections">,
): Promise<boolean> {
  const loanItems = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  for (const loanItem of loanItems) {
    const loan = await ctx.db.get(loanItem.loanId);
    if (loan && OCCUPYING_LOAN_STATUSES.has(loan.status)) {
      return true;
    }
  }

  return false;
}

export async function assertCollectionNotOnLoan(
  ctx: MutationCtx | QueryCtx,
  collectionId: Id<"collections">,
  message: string,
): Promise<void> {
  const collection = await ctx.db.get(collectionId);
  if (
    collection?.status === "loaned" ||
    (await collectionHasOccupyingLoan(ctx, collectionId))
  ) {
    throw new Error(message);
  }
}
