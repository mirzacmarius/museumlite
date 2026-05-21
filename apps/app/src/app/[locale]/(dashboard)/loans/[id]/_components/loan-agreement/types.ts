export interface LoanAgreementItem {
  accessionNumber: string;
  title: string;
  conditionOut?: string;
}

export interface LoanAgreementAccount {
  _id: string;
  accountNumber: string;
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  address2?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface LoanAgreementLoan {
  loanNumber: string;
  type: "incoming" | "outgoing";
  lenderBorrowerName: string;
  lenderBorrowerContact?: string;
  startDate: number;
  endDate?: number;
  terms?: string;
  insuranceValue?: number;
  notes?: string;
  approvedBy?: string;
  approvedAt?: number;
  account?: LoanAgreementAccount;
}

export interface LoanAgreementProps {
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
}
