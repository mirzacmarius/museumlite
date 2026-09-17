function nonEmptyTrimmed(value: string): string[] {
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

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

export function storedStringListIncludes(
  stored: string | undefined,
  selected: string,
): boolean {
  return parseStoredStringList(stored).includes(selected);
}
