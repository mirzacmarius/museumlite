import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface EditAccountFormData {
  businessName: string;
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
  accountType: "lender" | "borrower" | "both" | "institution" | "";
  selectedRoles: Id<"roles">[];
}
