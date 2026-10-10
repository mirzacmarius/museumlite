import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { LoanAgreementAccount } from "./loan-agreement/types";

export type LoanStatus =
  | "pending"
  | "active"
  | "dispatched"
  | "returned"
  | "cancelled";

export interface LoanItem {
  _id: Id<"loanItems">;
  collectionId: Id<"collections">;
  accessionNumber: string;
  title: string;
  conditionOut?: string;
  conditionIn?: string;
  custodyStatus?: "pending" | "dispatched" | "returned";
  dispatchOriginLocationId?: Id<"locations">;
  dispatchOriginUnknown?: boolean;
  returnDestinationLocationId?: Id<"locations">;
}

export interface WorkflowHistoryEntry {
  step: number;
  approvedBy: Id<"users">;
  approvedByName?: string;
  approvedAt: number;
  comment?: string;
}

export interface Loan {
  _id: Id<"loans">;
  organizationId: Id<"organizations">;
  loanNumber: string;
  type: "incoming" | "outgoing";
  /** The linked lender or borrower party, whose name the loan mirrors. */
  accountId?: Id<"accounts">;
  lenderBorrowerName: string;
  lenderBorrowerContact?: string;
  startDate: number;
  endDate?: number;
  insuranceValue?: number;
  /** ISO 4217 code of the insurance value; absent on older loans. */
  currency?: string;
  account?: LoanAgreementAccount;
  terms?: string;
  notes?: string;
  status: LoanStatus;
  workflowStep?: number;
  workflowHistory: WorkflowHistoryEntry[];
  items: LoanItem[];
}

export interface LoanDocument {
  _id: Id<"loanDocuments">;
  storageId: Id<"_storage">;
  documentType: "agreement" | "insurance" | "other";
  fileName: string;
  url: string | null;
  uploadedBy: Id<"users">;
  uploadedAt: number;
  uploaderName?: string;
}
