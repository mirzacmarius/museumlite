export type AccountHolderType = "organization" | "privatePerson";

export const DEFAULT_ACCOUNT_HOLDER_TYPE: AccountHolderType = "privatePerson";

export interface AccountHolderFields {
  kind: "privatePerson" | "organization";
  showContactPerson: boolean;
  showOrganizationNumber: boolean;
  showDateOfBirth: boolean;
}

export function accountHolderFields(
  holderType: AccountHolderType | undefined,
): AccountHolderFields {
  if (holderType === "privatePerson") {
    return {
      kind: "privatePerson",
      showContactPerson: false,
      showOrganizationNumber: false,
      showDateOfBirth: true,
    };
  }

  return {
    kind: "organization",
    showContactPerson: true,
    showOrganizationNumber: true,
    showDateOfBirth: false,
  };
}

export function formatDateInputValue(timestamp: number | undefined) {
  if (timestamp === undefined || Number.isNaN(timestamp)) {
    return "";
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

export function parseDateInputValue(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(`${value}T00:00:00Z`);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return timestamp;
}
