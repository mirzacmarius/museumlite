export type AccountHolderType = "organization" | "privatePerson";

export const DEFAULT_ACCOUNT_HOLDER_TYPE: AccountHolderType = "privatePerson";

export function isAccountHolderType(value: string): value is AccountHolderType {
  return value === "organization" || value === "privatePerson";
}

export function parseDateInputValue(value: string): number | undefined {
  if (!value) return undefined;

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(timestamp)) return undefined;

  return timestamp;
}
