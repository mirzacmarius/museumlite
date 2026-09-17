export type AccountHolderType = "organization" | "privatePerson";

export type CustomerCategory = "person" | "business" | "nonProfit";

export const DEFAULT_ACCOUNT_HOLDER_TYPE: AccountHolderType = "organization";

export const DEFAULT_CUSTOMER_CATEGORY: CustomerCategory = "business";

export function customerCategoryToHolderType(
  category: CustomerCategory,
): AccountHolderType {
  return category === "person" ? "privatePerson" : "organization";
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
