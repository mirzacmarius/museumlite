import type { HistoricalDate } from "@v1/backend/convex/utils/provenanceValidators";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  formatHistoricalDate,
  formatHistoricalPeriod,
  type HistoricalPeriodLabels,
} from "./historical-date";

/** Formats partial dates and claim periods in the current locale. */
export function useHistoricalDateFormat() {
  const t = useScopedI18n("provenance.dates");
  const locale = useCurrentLocale();
  const labels: HistoricalPeriodLabels = {
    decade: (year) => t("decade", { year }),
    circa: (date) => t("circa", { date }),
    notAfter: (date) => t("notAfter", { date }),
    notBefore: (date) => t("notBefore", { date }),
    uncertain: (date) => t("uncertain", { date }),
    range: (start, end) => t("range", { start, end }),
    from: (start) => t("from", { start }),
    until: (end) => t("until", { end }),
    openStart: (end) => t("openStart", { end }),
    undated: t("undated"),
  };
  return {
    date: (date: HistoricalDate) => formatHistoricalDate(date, locale, labels),
    period: (start?: HistoricalDate, end?: HistoricalDate) =>
      formatHistoricalPeriod(start, end, locale, labels),
  };
}
