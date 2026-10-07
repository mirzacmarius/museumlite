import type { Doc } from "../_generated/dataModel";

export type LoanItemCustodyStatus = "pending" | "dispatched" | "returned";

export function isLoanItemReturned(item: Doc<"loanItems">): boolean {
  if (item.custodyStatus === "returned") {
    return true;
  }
  return item.conditionIn != null && String(item.conditionIn).trim().length > 0;
}

export function isLoanItemDispatched(
  item: Doc<"loanItems">,
  loanStatus: Doc<"loans">["status"],
): boolean {
  if (item.custodyStatus === "dispatched" || item.custodyStatus === "returned") {
    return true;
  }
  if (loanStatus === "dispatched" && !isLoanItemReturned(item)) {
    return true;
  }
  return item.dispatchedAt != null;
}

export function outstandingLoanItems(
  items: Doc<"loanItems">[],
  loanStatus: Doc<"loans">["status"],
): Doc<"loanItems">[] {
  return items.filter((item) => !isLoanItemReturned(item));
}

export function allLoanItemsReturned(items: Doc<"loanItems">[]): boolean {
  return items.length > 0 && items.every((item) => isLoanItemReturned(item));
}

export function allOutstandingItemsDispatched(
  items: Doc<"loanItems">[],
  loanStatus: Doc<"loans">["status"],
): boolean {
  const outstanding = outstandingLoanItems(items, loanStatus);
  if (outstanding.length === 0) {
    return false;
  }
  return outstanding.every((item) => isLoanItemDispatched(item, loanStatus));
}

export function reconcileLoanStatusFromItems(
  items: Doc<"loanItems">[],
  currentStatus: Doc<"loans">["status"],
): Doc<"loans">["status"] {
  if (items.length === 0) {
    return currentStatus;
  }
  if (allLoanItemsReturned(items)) {
    return "returned";
  }
  if (
    allOutstandingItemsDispatched(items, currentStatus) &&
    (currentStatus === "active" || currentStatus === "dispatched")
  ) {
    return "dispatched";
  }
  if (currentStatus === "dispatched") {
    return "dispatched";
  }
  if (currentStatus === "active") {
    return "active";
  }
  return currentStatus;
}
