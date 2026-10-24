import {
  type ProductionDate,
  type ProductionDatePoint,
  type ProductionDateSource,
  parseEdtf,
} from "@v1/backend/convex/utils/productionDates";
import { formatDate } from "./format-date";
import type { FormatLocale } from "./format-number";

/** Wording for qualified and spanning dates, as `provenance.dates` holds it. */
export interface ProductionDateLabels {
  decade: (year: string) => string;
  circa: (date: string) => string;
  notAfter: (date: string) => string;
  notBefore: (date: string) => string;
  uncertain: (date: string) => string;
  range: (start: string, end: string) => string;
}

type CalendarPrecision = "day" | "month" | "year";

const CALENDAR_OPTIONS: Record<CalendarPrecision, Intl.DateTimeFormatOptions> =
  {
    day: { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
    month: { year: "numeric", month: "long", timeZone: "UTC" },
    year: { year: "numeric", timeZone: "UTC" },
  };

/** A calendar date in the locale; years before 1 AD name their era. */
function formatCalendar(
  locale: FormatLocale,
  precision: CalendarPrecision,
  year: number,
  month = 1,
  day = 1,
) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return formatDate(date, locale, {
    ...CALENDAR_OPTIONS[precision],
    era: year > 0 ? undefined : "short",
  });
}

/** An astronomical year as people write it: "1850", "500 BC" for -499. */
export function formatProductionYear(year: number, locale: FormatLocale) {
  return year > 0 ? String(year) : formatCalendar(locale, "year", year);
}

function formatPoint(
  point: ProductionDatePoint,
  locale: FormatLocale,
  labels: ProductionDateLabels,
) {
  const yearRange = (span: number) =>
    labels.range(
      formatProductionYear(point.year, locale),
      formatProductionYear(point.year + span - 1, locale),
    );
  let text: string;
  switch (point.precision) {
    case "day":
    case "month":
      text = formatCalendar(
        locale,
        point.precision,
        point.year,
        point.month,
        point.day,
      );
      break;
    case "year":
      text = formatProductionYear(point.year, locale);
      break;
    case "decade":
      // "The 1850s BC" would be one year off, so a BC decade shows its years.
      text = point.year > 0 ? labels.decade(String(point.year)) : yearRange(10);
      break;
    case "century":
      text = yearRange(100);
      break;
  }
  if (point.uncertain) text = labels.uncertain(text);
  return point.approximate ? labels.circa(text) : text;
}

/** A production date in the locale: "c. 1850", "1850 – 1860", "by 1900". */
export function formatProductionDate(
  date: ProductionDate,
  locale: FormatLocale,
  labels: ProductionDateLabels,
) {
  if (date.kind === "date") return formatPoint(date.date, locale, labels);
  const start = date.start && formatPoint(date.start, locale, labels);
  const end = date.end && formatPoint(date.end, locale, labels);
  if (start && end) return labels.range(start, end);
  if (start) return labels.notBefore(start);
  return end ? labels.notAfter(end) : "";
}

/**
 * An Object's date made as staff wrote it, else its structured date in the
 * locale; undefined when neither is recorded.
 */
export function formatDateMade(
  source: ProductionDateSource,
  locale: FormatLocale,
  labels: ProductionDateLabels,
) {
  if (source.dateCreated?.trim()) return source.dateCreated;
  const entered = source.dateCreatedEdtf
    ? parseEdtf(source.dateCreatedEdtf)
    : null;
  return entered ? formatProductionDate(entered, locale, labels) : undefined;
}
