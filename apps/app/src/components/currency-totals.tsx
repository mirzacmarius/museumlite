"use client";

import { type FormatLocale, formatMoney } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface CurrencyTotalsProps {
  totals: {
    byCurrency: Array<{ currency: string; total: number }>;
    currencyNotRecordedCount?: number;
  };
  emptyLabel: string;
}

/**
 * Amounts per currency, one line each. Amounts in different currencies are
 * never added together; records without a currency are counted, not summed.
 */
export function CurrencyTotals({ totals, emptyLabel }: CurrencyTotalsProps) {
  const t = useScopedI18n("valuation");
  const locale = useCurrentLocale() as FormatLocale;
  const notRecorded = totals.currencyNotRecordedCount ?? 0;
  if (totals.byCurrency.length === 0 && notRecorded === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-1">
      <ul className="space-y-1" aria-label={t("totalsByCurrency")}>
        {totals.byCurrency.map((entry) => (
          <li
            key={entry.currency}
            className="flex items-baseline justify-between gap-4 text-sm"
          >
            <span className="text-muted-foreground">{entry.currency}</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatMoney(entry.total, locale, entry.currency)}
            </span>
          </li>
        ))}
      </ul>
      {notRecorded > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("withoutCurrency", { count: notRecorded })}
        </p>
      ) : null}
    </div>
  );
}
