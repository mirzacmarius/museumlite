"use client";

import { type FormatLocale, formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

/**
 * An amount recorded on a catalogue or loan record without a currency. It is
 * shown as entered, labelled as a recorded value rather than an appraisal,
 * and never given a currency symbol.
 */
export function RecordedValue({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const t = useScopedI18n("valuation");
  const locale = useCurrentLocale() as FormatLocale;
  if (!value) return <span className={className}>—</span>;
  return (
    <span className="inline-flex flex-col">
      <span className={className}>{formatNumber(value, locale)}</span>
      <span className="text-[10px] font-normal text-muted-foreground">
        {t("recordedValueHint")}
      </span>
    </span>
  );
}
