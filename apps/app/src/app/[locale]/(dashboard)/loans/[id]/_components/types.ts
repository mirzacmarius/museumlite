import type { Id } from "@v1/backend/convex/_generated/dataModel";

export type LoanStatus =
  | "pending"
  | "active"
  | "dispatched"
  | "returned"
  | "cancelled";

export interface LoanItem {
  _id: Id<"loanItems">;
  accessionNumber: string;
  title: string;
  conditionOut?: string;
  conditionIn?: string;
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
  loanNumber: string;
  type: "incoming" | "outgoing";
  lenderBorrowerName: string;
  lenderBorrowerContact?: string;
  startDate: number;
  endDate?: number;
  insuranceValue?: number;
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
