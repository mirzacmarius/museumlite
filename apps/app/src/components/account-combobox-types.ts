import type { CustomerCategory } from "@/lib/account-holder";
import { DEFAULT_CUSTOMER_CATEGORY } from "@/lib/account-holder";

export interface AccountComboboxProps {
  organizationId?: string;
  value?: string;
  onValueChange?: (accountId: string | undefined) => void;
  onAccountSelect?: (
    account:
      | {
          _id: string;
          businessName?: string;
          contactPerson?: string;
          email?: string;
          phone?: string;
        }
      | undefined,
  ) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface NewAccountForm {
  customerCategory: CustomerCategory;
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
}

export const initialAccountFormState: NewAccountForm = {
  customerCategory: DEFAULT_CUSTOMER_CATEGORY,
  businessName: "",
  taxId: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  address2: "",
  zipCode: "",
  city: "",
  country: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
};
