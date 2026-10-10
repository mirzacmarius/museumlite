"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import {
  REGISTER_TOTALS,
  type RegisterProfile,
} from "@v1/backend/convex/utils/registerProfiles";
import type { FunctionReturnType } from "convex/server";
import { useRegisterValueLabels } from "@/hooks/use-register-value-labels";
import { type FormatLocale, formatMoney } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type Totals = NonNullable<
  FunctionReturnType<typeof api.exports.status>["totals"]
>;

interface RegisterTotalsProps {
  profile: RegisterProfile;
  totals: Totals;
}

/**
 * A report's totals, one line per group with an amount per currency.
 * Amounts in different currencies are never added together.
 */
export function RegisterTotals({ profile, totals }: RegisterTotalsProps) {
  const t = useScopedI18n("registerReports");
  const locale = useCurrentLocale() as FormatLocale;
  const valueLabels: Record<
    string,
    Record<string, string>
  > = useRegisterValueLabels();
  const groupBy = REGISTER_TOTALS[profile]?.groupBy ?? [];
  const groupLabel = (group: Totals[number]["group"]) =>
    group
      .map((value, index) => {
        const column = groupBy[index];
        if (value === null) return t("totalsNotStated");
        return (column && valueLabels[column]?.[value]) ?? value;
      })
      .join(" · ");
  const groups = new Map<string, { label: string; entries: Totals }>();
  for (const entry of totals) {
    const key = JSON.stringify(entry.group);
    const group = groups.get(key) ?? {
      label: groupLabel(entry.group),
      entries: [],
    };
    group.entries.push(entry);
    groups.set(key, group);
  }
  return (
    <section aria-label={t("totalsTitle")} className="mt-2 space-y-1 text-xs">
      <p className="font-medium">{t("totalsTitle")}</p>
      {totals.length === 0 ? (
        <p className="text-muted-foreground">{t("totalsNone")}</p>
      ) : (
        <dl className="space-y-1">
          {[...groups.entries()].map(([key, group]) => (
            <div key={key} className="flex flex-wrap gap-x-3">
              <dt className="text-muted-foreground">{group.label}</dt>
              {group.entries.map((entry) => (
                <dd key={entry.currency ?? ""} className="tabular-nums">
                  {entry.currency !== null && entry.total !== null
                    ? t("totalsAmount", {
                        amount: formatMoney(
                          Number(entry.total),
                          locale,
                          entry.currency,
                        ),
                        count: entry.count,
                      })
                    : t("totalsNotSummed", { count: entry.count })}
                </dd>
              ))}
            </div>
          ))}
        </dl>
      )}
      <p className="text-muted-foreground">{t("totalsNote")}</p>
    </section>
  );
}
