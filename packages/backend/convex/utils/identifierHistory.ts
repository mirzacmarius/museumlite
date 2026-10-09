function dedupeStrings(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return Array.from(
    new Set(
      values.flatMap((value) => {
        const trimmedValue = value.trim();
        return trimmedValue.length > 0 ? [trimmedValue] : [];
      }),
    ),
  );
}

/**
 * Identifier fields after an object takes a new catalog identifier. The
 * previous identifier stays as an alternate and its history interval closes;
 * nothing is renumbered silently.
 */
export function buildUpdatedAccessionState(
  collection: {
    accessionNumber: string;
    alternateAccessionNumbers?: string[];
    accessionNumberHistory?: Array<{
      number: string;
      validFrom: number;
      validTo?: number;
    }>;
  },
  nextAccessionNumber: string,
  now: number,
) {
  if (collection.accessionNumber === nextAccessionNumber) {
    return {
      accessionNumber: collection.accessionNumber,
      alternateAccessionNumbers: dedupeStrings(
        collection.alternateAccessionNumbers,
      ),
      accessionNumberHistory: collection.accessionNumberHistory,
    };
  }

  const alternateAccessionNumbers = dedupeStrings([
    ...(collection.alternateAccessionNumbers ?? []),
    collection.accessionNumber,
  ]);

  const isOpenCurrentEntry = (entry: { number: string; validTo?: number }) =>
    entry.validTo === undefined && entry.number === collection.accessionNumber;
  const existingHistory = collection.accessionNumberHistory ?? [];
  const history = existingHistory.map((entry) =>
    isOpenCurrentEntry(entry) ? { ...entry, validTo: now } : entry,
  );

  if (!existingHistory.some(isOpenCurrentEntry)) {
    history.push({
      number: collection.accessionNumber,
      validFrom: now,
      validTo: now,
    });
  }

  history.push({
    number: nextAccessionNumber,
    validFrom: now,
  });

  return {
    accessionNumber: nextAccessionNumber,
    alternateAccessionNumbers,
    accessionNumberHistory: history,
  };
}
