function nonEmptyTrimmed(value: string): string[] {
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

export function parseStringListField(
  value?: string | string[] | null,
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(nonEmptyTrimmed);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(trimmedValue);
    if (Array.isArray(parsedValue)) {
      return parsedValue.flatMap((item) =>
        typeof item === "string" ? nonEmptyTrimmed(item) : [],
      );
    }
    if (typeof parsedValue === "string") {
      return nonEmptyTrimmed(parsedValue);
    }
  } catch {
    return [trimmedValue];
  }

  return [trimmedValue];
}

export function serializeStringListField(
  value?: string | string[] | null,
): string | undefined {
  if (Array.isArray(value)) {
    const normalizedItems = parseStringListField(value);
    return normalizedItems.length > 0
      ? JSON.stringify(normalizedItems)
      : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue || undefined;
}

export function formatStringListField(
  value?: string | string[] | null,
  emptyLabel = "",
): string {
  return parseStringListField(value).join(", ") || emptyLabel;
}

export function collectUniqueStringListValues(
  values: Array<string | string[] | null | undefined>,
): string[] {
  return [
    ...new Set(values.flatMap((value) => parseStringListField(value))),
  ].sort((a, b) => a.localeCompare(b));
}
