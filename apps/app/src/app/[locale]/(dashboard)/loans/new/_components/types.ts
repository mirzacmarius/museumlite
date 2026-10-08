export interface NewLoanFormData {
  loanNumber: string;
  type: "incoming" | "outgoing";
  accountId: string | undefined;
  lenderBorrowerName: string;
  lenderBorrowerContact: string;
  startDate: Date;
  endDate: Date | undefined;
  terms: string;
  insuranceValue: string;
  currency: string;
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
  currency: "",
  notes: "",
};
