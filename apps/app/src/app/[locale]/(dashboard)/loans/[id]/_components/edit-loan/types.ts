export interface EditLoanFormData {
  lenderBorrowerName: string;
  lenderBorrowerContact: string;
  startDate: Date;
  endDate: Date | undefined;
  terms: string;
  insuranceValue: string;
  notes: string;
}

export const EMPTY_EDIT_LOAN_FORM: EditLoanFormData = {
  lenderBorrowerName: "",
  lenderBorrowerContact: "",
  startDate: new Date(),
  endDate: undefined,
  terms: "",
  insuranceValue: "",
  notes: "",
};
