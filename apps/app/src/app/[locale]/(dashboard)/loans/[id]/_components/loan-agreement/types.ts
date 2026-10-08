import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface LoanAgreementItem {
  accessionNumber: string;
  title: string;
  conditionOut?: string;
}

export interface LoanAgreementAccount {
  _id: string;
  accountNumber: string;
  businessName?: string;
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
  /** ISO 4217 code of the insurance value; absent on older loans. */
  currency?: string;
  account?: LoanAgreementAccount;
}

export interface LoanAgreementProps {
  loanId: Id<"loans">;
  loan: LoanAgreementLoan;
  items: LoanAgreementItem[];
  organizationName: string;
}
