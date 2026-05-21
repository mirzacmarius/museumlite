import type { AccountHolderType } from "@/lib/account-holder";
import { DEFAULT_ACCOUNT_HOLDER_TYPE } from "@/lib/account-holder";

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
}

export const initialAccountFormState: NewAccountForm = {
  holderType: DEFAULT_ACCOUNT_HOLDER_TYPE,
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
