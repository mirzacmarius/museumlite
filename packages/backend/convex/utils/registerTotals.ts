import type { Infer } from "convex/values";
import {
  addDecimalAmounts,
  decimalAmountText,
  normalizeCurrency,
} from "./currency";
import type { registerTotalsValidator } from "./exportContract";
import {
  REGISTER_TOTALS,
  REGISTER_TOTALS_DEFINITION,
  type RegisterProfile,
} from "./registerProfiles";

export type RegisterTotals = Infer<typeof registerTotalsValidator>;
type TotalsEntry = RegisterTotals[number];

function compareNullable(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function compareEntries(left: TotalsEntry, right: TotalsEntry) {
  const length = Math.max(left.group.length, right.group.length);
  for (let index = 0; index < length; index++) {
    const order = compareNullable(
      left.group[index] ?? null,
      right.group[index] ?? null,
    );
    if (order !== 0) return order;
  }
  return compareNullable(left.currency, right.currency);
}

/** Adds totals exactly, keeping groups and currencies apart. */
export function mergeRegisterTotals(
  base: RegisterTotals,
  added: RegisterTotals,
): RegisterTotals {
  const merged = new Map<string, TotalsEntry>();
  for (const entry of [...base, ...added]) {
    const key = JSON.stringify([entry.group, entry.currency]);
    const existing = merged.get(key);
    merged.set(
      key,
      existing
        ? {
            ...existing,
            total:
              existing.total === null || entry.total === null
                ? null
                : addDecimalAmounts(existing.total, entry.total),
            count: existing.count + entry.count,
          }
        : entry,
    );
  }
  return Array.from(merged.values()).sort(compareEntries);
}

/**
 * Totals of one page of rows, or undefined for profiles without monetary
 * columns.
 */
export function registerPageTotals(
  profile: RegisterProfile,
  rows: ReadonlyArray<Record<string, unknown>>,
): RegisterTotals | undefined {
  const spec = REGISTER_TOTALS[profile];
  if (!spec) return undefined;
  const entries: RegisterTotals = [];
  for (const row of rows) {
    const amount = row[spec.amountColumn];
    if (typeof amount !== "number") continue;
    const recorded = row[spec.currencyColumn];
    const currency = normalizeCurrency(
      typeof recorded === "string" ? recorded : undefined,
    );
    entries.push({
      group: spec.groupBy.map((column) => {
        const value = row[column];
        return typeof value === "string" ? value : null;
      }),
      currency,
      total: currency === null ? null : decimalAmountText(amount),
      count: 1,
    });
  }
  return mergeRegisterTotals([], entries);
}

/** The manifest's totals section, with each group keyed by its column. */
export function manifestTotals(
  profile: RegisterProfile,
  totals: RegisterTotals | undefined,
) {
  const spec = REGISTER_TOTALS[profile];
  if (!spec) return undefined;
  return {
    definition: REGISTER_TOTALS_DEFINITION,
    groupBy: spec.groupBy,
    amountColumn: spec.amountColumn,
    currencyColumn: spec.currencyColumn,
    entries: (totals ?? []).map((entry) => ({
      ...Object.fromEntries(
        spec.groupBy.map((column, index) => [
          column,
          entry.group[index] ?? null,
        ]),
      ),
      currency: entry.currency,
      total: entry.total,
      count: entry.count,
    })),
  };
}
