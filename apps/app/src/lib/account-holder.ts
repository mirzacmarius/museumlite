export type AccountHolderType = "organization" | "privatePerson";

export type LoanAccountType = "lender" | "borrower" | "both" | "institution";

export const DEFAULT_ACCOUNT_HOLDER_TYPE: AccountHolderType = "privatePerson";

export const ACCOUNT_HOLDER_TYPES: AccountHolderType[] = [
  "privatePerson",
  "organization",
];

export const LOAN_ACCOUNT_TYPES: LoanAccountType[] = [
  "lender",
  "borrower",
  "both",
  "institution",
];

export function isPrivatePersonHolder(
  holderType: AccountHolderType | string | undefined,
): holderType is "privatePerson" {
  return holderType === "privatePerson";
}

export function isOrganizationHolder(
  holderType: AccountHolderType | string | undefined,
): boolean {
  return !isPrivatePersonHolder(holderType);
}

export function isAccountHolderType(value: string): value is AccountHolderType {
  return ACCOUNT_HOLDER_TYPES.some((type) => type === value);
}

export function resolveAccountHolderType(
  holderType: AccountHolderType | string | undefined,
): AccountHolderType {
  return isPrivatePersonHolder(holderType) ? "privatePerson" : "organization";
}

export function defaultLoanAccountTypeForHolder(
  holderType: AccountHolderType,
): LoanAccountType {
  return holderType === "organization" ? "institution" : "lender";
}

export function loanAccountTypesForHolder(
  holderType: AccountHolderType,
): LoanAccountType[] {
  if (holderType === "privatePerson") return ["lender", "borrower", "both"];
  return LOAN_ACCOUNT_TYPES;
}

export function isLoanAccountType(
  value: string | undefined,
): value is LoanAccountType {
  return LOAN_ACCOUNT_TYPES.some((type) => type === value);
}

export function resolveLoanAccountTypeForHolder(
  holderType: AccountHolderType,
  current: LoanAccountType | "" | undefined,
): LoanAccountType {
  const allowed = loanAccountTypesForHolder(holderType);
  if (current && allowed.includes(current)) return current;
  return defaultLoanAccountTypeForHolder(holderType);
}

export function formPatchForHolderType(
  holderType: AccountHolderType,
  currentAccountType: LoanAccountType | "" | undefined,
): { holderType: AccountHolderType; accountType: LoanAccountType } {
  return {
    holderType,
    accountType: resolveLoanAccountTypeForHolder(
      holderType,
      currentAccountType,
    ),
  };
}

export interface HolderScopedAccountFields {
  taxId: string | undefined;
  dateOfBirth: number | undefined;
  contactPerson: string | undefined;
  contactPhone: string | undefined;
  contactEmail: string | undefined;
}

export function holderScopedAccountFields(
  holderType: AccountHolderType,
  fields: {
    taxId: string;
    dateOfBirth: string;
    contactPerson: string;
    contactPhone: string;
    contactEmail: string;
  },
): HolderScopedAccountFields {
  if (isOrganizationHolder(holderType)) {
    return {
      taxId: fields.taxId || undefined,
      dateOfBirth: undefined,
      contactPerson: fields.contactPerson || undefined,
      contactPhone: fields.contactPhone || undefined,
      contactEmail: fields.contactEmail || undefined,
    };
  }

  return {
    taxId: undefined,
    dateOfBirth: parseDateInputValue(fields.dateOfBirth),
    contactPerson: undefined,
    contactPhone: undefined,
    contactEmail: undefined,
  };
}

export function parseDateInputValue(value: string): number | undefined {
  if (!value) return undefined;

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) return undefined;

  return timestamp;
}

export function formatDateInputValue(value: number | undefined): string {
  if (value === undefined) return "";
  return new Date(value).toISOString().slice(0, 10);
}
