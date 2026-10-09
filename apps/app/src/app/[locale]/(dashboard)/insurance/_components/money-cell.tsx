"use client";

import { type FormatLocale, formatMoney } from "@/lib/format-number";

/** An amount in its recorded currency, or flagged when none was recorded. */
export function MoneyCell({
  value,
  currency,
  locale,
  notRecordedLabel,
}: {
  value: number;
  currency: string | undefined;
  locale: string;
  notRecordedLabel: string;
}) {
  return (
    <span className="flex flex-col">
      <span className="tabular-nums">
        {formatMoney(value, locale as FormatLocale, currency)}
      </span>
      {currency ? null : (
        <span className="text-[10px] text-amber-400">{notRecordedLabel}</span>
      )}
    </span>
  );
}
