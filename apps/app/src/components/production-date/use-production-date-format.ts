import type {
  ProductionDate,
  ProductionDateSource,
  ProductionYears,
} from "@v1/backend/convex/utils/productionDates";
import { useMemo } from "react";
import {
  formatDateMade,
  formatProductionDate,
  formatProductionYear,
  type ProductionDateLabels,
} from "@/lib/production-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

/** Formats an Object's date made, and the years it sorts by, in the locale. */
export function useProductionDateFormat() {
  const t = useScopedI18n("provenance.dates");
  const tDate = useScopedI18n("objects.form.productionDate");
  const locale = useCurrentLocale();
  return useMemo(() => {
    const labels: ProductionDateLabels = {
      decade: (year) => t("decade", { year }),
      circa: (date) => t("circa", { date }),
      notAfter: (date) => t("notAfter", { date }),
      notBefore: (date) => t("notBefore", { date }),
      uncertain: (date) => t("uncertain", { date }),
      range: (start, end) => t("range", { start, end }),
    };
    const year = (value: number) => formatProductionYear(value, locale);
    return {
      date: (date: ProductionDate) =>
        formatProductionDate(date, locale, labels),
      /** The text as written, else the structured date; undefined for none. */
      dateMade: (source: ProductionDateSource) =>
        formatDateMade(source, locale, labels),
      /** "Sorting and filters use 1845 – 1855.", an open side said so. */
      years: ({ earliestYear: first, latestYear: last }: ProductionYears) => {
        if (first !== undefined && last !== undefined) {
          return tDate("years", {
            years:
              first === last
                ? year(first)
                : t("range", { start: year(first), end: year(last) }),
          });
        }
        if (first !== undefined) {
          return tDate("yearsFrom", { start: year(first) });
        }
        if (last !== undefined) return tDate("yearsUntil", { end: year(last) });
        return tDate("undated");
      },
    };
  }, [locale, t, tDate]);
}
