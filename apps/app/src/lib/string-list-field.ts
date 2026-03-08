export function parseStringListField(
  value?: string | string[] | null,
): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
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
      return parsedValue
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof parsedValue === "string") {
      return [parsedValue.trim()].filter(Boolean);
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
  const normalizedItems = parseStringListField(value);
  return normalizedItems.length > 0 ? normalizedItems.join(", ") : emptyLabel;
}
