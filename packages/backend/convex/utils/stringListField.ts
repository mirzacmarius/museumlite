export function parseStoredStringList(value?: string | null): string[] {
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
      return parsedValue.flatMap((item) => {
        if (typeof item !== "string") {
          return [];
        }

        const trimmedItem = item.trim();
        return trimmedItem ? [trimmedItem] : [];
      });
    }

    if (typeof parsedValue === "string") {
      return [parsedValue.trim()].filter(Boolean);
    }
  } catch {
    return [trimmedValue];
  }

  return [trimmedValue];
}

export function storedStringListIncludes(
  stored: string | undefined,
  selected: string,
): boolean {
  return parseStoredStringList(stored).includes(selected);
}
