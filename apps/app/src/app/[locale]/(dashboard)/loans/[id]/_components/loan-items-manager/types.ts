import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface ManagedLoanItem {
  _id: Id<"loanItems">;
  collectionId: Id<"collections">;
  accessionNumber: string;
  title: string;
  conditionOut?: string;
  conditionIn?: string;
  notes?: string;
}

export interface LoanItemsManagerProps {
  loanId: string;
  loanItems: ManagedLoanItem[];
  organizationId: string;
  loanStatus: string;
  loanType?: string;
}

export interface ItemToReturn {
  id: string;
  accessionNumber: string;
  title: string;
  collectionId: string;
}
