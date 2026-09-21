import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { AccountHolderType, LoanAccountType } from "@/lib/account-holder";

export interface EditAccountFormData {
  holderType: AccountHolderType;
  businessName: string;
  taxId: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  address2: string;
  zipCode: string;
  city: string;
  country: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  accountType: LoanAccountType | "";
  selectedRoles: Id<"roles">[];
}
