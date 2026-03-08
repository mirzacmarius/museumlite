type LocationCustomFieldValue = string | number | boolean | string[] | null;

export type LocationCustomFields = Record<string, LocationCustomFieldValue>;

export const LOCATION_UNIT_COUNT_FIELDS = [
  {
    key: "vitrineCount",
    labelKey: "vitrineCountLabel",
    placeholderKey: "vitrineCountPlaceholder",
  },
  {
    key: "wallCount",
    labelKey: "wallCountLabel",
    placeholderKey: "wallCountPlaceholder",
  },
  {
    key: "cabinetCount",
    labelKey: "cabinetCountLabel",
    placeholderKey: "cabinetCountPlaceholder",
  },
  {
    key: "shelfCount",
    labelKey: "shelfCountLabel",
    placeholderKey: "shelfCountPlaceholder",
  },
] as const;

export type LocationUnitCountFieldKey =
  (typeof LOCATION_UNIT_COUNT_FIELDS)[number]["key"];

export function getNumericCustomFieldValue(
  customFields: LocationCustomFields | undefined,
  key: string,
) {
  const value = customFields?.[key];
  return typeof value === "number" ? value.toString() : "";
}

export function setOptionalNumberCustomField(
  customFields: LocationCustomFields,
  key: string,
  value: string,
  parser: (value: string) => number = Number.parseInt,
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    delete customFields[key];
    return;
  }

  customFields[key] = parser(trimmedValue);
}

export function hasCustomFieldValues(customFields: LocationCustomFields) {
  return Object.keys(customFields).length > 0;
}

export function getNumericCustomFieldNumber(
  customFields: LocationCustomFields | undefined,
  key: string,
) {
  const value = customFields?.[key];
  return typeof value === "number" ? value : undefined;
}
