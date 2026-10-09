import { defineListState } from "@/lib/list-state";

export const LOAN_PAGE_SIZE = 50;

/** The loans list URL: search, status and direction filters, loaded depth. */
export const loanListState = defineListState({
  filters: {
    status: ["all", "pending", "active", "dispatched", "returned", "cancelled"],
    type: ["all", "incoming", "outgoing"],
  },
  sorts: ["newest"],
  pageSize: LOAN_PAGE_SIZE,
  maxDepth: 500,
});
