import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface NewLoanFormData {
  loanNumber: string;
  type: "incoming" | "outgoing";
  accountId: Id<"accounts"> | undefined;
  lenderBorrowerName: string;
  lenderBorrowerContact: string;
  startDate: Date;
  endDate: Date | undefined;
  terms: string;
  insuranceValue: string;
  notes: string;
}

export const EMPTY_NEW_LOAN_FORM: NewLoanFormData = {
  loanNumber: "",
  type: "incoming",
  accountId: undefined,
  lenderBorrowerName: "",
  lenderBorrowerContact: "",
  startDate: new Date(),
  endDate: undefined,
  terms: "",
  insuranceValue: "",
  notes: "",
};
