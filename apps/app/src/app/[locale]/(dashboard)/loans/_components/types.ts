import type { Id } from "@v1/backend/convex/_generated/dataModel";

export type LoanStatus =
  | "pending"
  | "active"
  | "dispatched"
  | "returned"
  | "cancelled"
  | "all";

export type LoanType = "incoming" | "outgoing" | "all";

export interface LoanListProps {
  organizationId: string;
  statusFilter: LoanStatus;
  typeFilter: LoanType;
  searchQuery: string;
  onStatusFilterChange: (status: LoanStatus) => void;
  onTypeFilterChange: (type: LoanType) => void;
  onSearchQueryChange: (query: string) => void;
}

export interface LoanListRow extends Record<string, unknown> {
  _id: Id<"loans">;
  loanNumber: string;
  type: string;
  lenderBorrowerName: string;
  startDate: number;
  endDate?: number;
  status: string;
  itemCount?: number;
}
