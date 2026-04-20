interface OwnershipDateRange {
  startYear?: string;
  endYear?: string;
}

interface FormatOwnershipDateRangeOptions {
  presentLabel?: string;
  separator?: string;
}

export function formatOwnershipDateRange(
  entry: OwnershipDateRange,
  options: FormatOwnershipDateRangeOptions = {},
) {
  const from = entry.startYear?.trim();
  const to = entry.endYear?.trim();
  const separator = options.separator ?? " - ";
  const presentLabel = options.presentLabel ?? "Present";

  if (from && to) {
    return `${from}${separator}${to}`;
  }

  if (from) {
    return `${from}${separator}${presentLabel}`;
  }

  if (to) {
    return to;
  }

  return null;
}
