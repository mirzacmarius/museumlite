import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { LoanItem } from "../types";

export function isLoanItemReturned(item: { conditionIn?: string }): boolean {
  return item.conditionIn != null && String(item.conditionIn).trim().length > 0;
}

export function getNonReturnedItemIds(
  loanItems: LoanItem[],
): Id<"loanItems">[] {
  return loanItems.flatMap((item) =>
    isLoanItemReturned(item) ? [] : [item._id],
  );
}
