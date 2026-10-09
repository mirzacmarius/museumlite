import type {
  HistoricalDate,
  HistoricalDatePrecision,
  HistoricalDateQualifier,
} from "@v1/backend/convex/utils/provenanceValidators";

export interface HistoricalDateLabels {
  decade: (year: string) => string;
  circa: (date: string) => string;
  notAfter: (date: string) => string;
  notBefore: (date: string) => string;
  uncertain: (date: string) => string;
}

export interface HistoricalPeriodLabels extends HistoricalDateLabels {
  range: (start: string, end: string) => string;
  from: (start: string) => string;
  until: (end: string) => string;
  /** A qualified end with no start: "… – by 1938". */
  openStart: (end: string) => string;
  undated: string;
}

const DAY: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};
const MONTH: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
};
const APP_LOCALES = ["en", "es", "fr", "no", "ro"] as const;
type AppLocale = (typeof APP_LOCALES)[number];
const calendarFormatters: Record<
  AppLocale,
  { day: Intl.DateTimeFormat; month: Intl.DateTimeFormat }
> = {
  en: {
    day: new Intl.DateTimeFormat("en", DAY),
    month: new Intl.DateTimeFormat("en", MONTH),
  },
  es: {
    day: new Intl.DateTimeFormat("es", DAY),
    month: new Intl.DateTimeFormat("es", MONTH),
  },
  fr: {
    day: new Intl.DateTimeFormat("fr", DAY),
    month: new Intl.DateTimeFormat("fr", MONTH),
  },
  no: {
    day: new Intl.DateTimeFormat("no", DAY),
    month: new Intl.DateTimeFormat("no", MONTH),
  },
  ro: {
    day: new Intl.DateTimeFormat("ro", DAY),
    month: new Intl.DateTimeFormat("ro", MONTH),
  },
};

function calendarFormatter(locale: string, precision: "day" | "month") {
  const appLocale = (APP_LOCALES as readonly string[]).includes(locale)
    ? (locale as AppLocale)
    : "en";
  return calendarFormatters[appLocale][precision];
}

/** A UTC calendar day, including years before 100. */
function calendarDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(2000, month - 1, day));
  date.setUTCFullYear(year);
  return date;
}

/**
 * A partial date as precisely as it was recorded: "12 May 1925", "May 1925",
 * "1925", "1920s", qualified as circa, by or after, and marked when unsure.
 */
export function formatHistoricalDate(
  date: HistoricalDate,
  locale: string,
  labels: HistoricalDateLabels,
): string {
  let text: string;
  switch (date.precision) {
    case "day":
      text = calendarFormatter(locale, "day").format(
        calendarDay(date.year, date.month ?? 1, date.day ?? 1),
      );
      break;
    case "month":
      text = calendarFormatter(locale, "month").format(
        calendarDay(date.year, date.month ?? 1, 1),
      );
      break;
    case "year":
      text = String(date.year);
      break;
    case "decade":
      text = labels.decade(String(date.year));
      break;
  }
  if (date.uncertain) text = labels.uncertain(text);
  switch (date.qualifier) {
    case "circa":
      return labels.circa(text);
    case "notAfter":
      return labels.notAfter(text);
    case "notBefore":
      return labels.notBefore(text);
    default:
      return text;
  }
}

/**
 * A claim's period. A lone qualified start ("by 1937") reads on its own and
 * a lone qualified end is open-started; a missing side is never guessed.
 */
export function formatHistoricalPeriod(
  startDate: HistoricalDate | undefined,
  endDate: HistoricalDate | undefined,
  locale: string,
  labels: HistoricalPeriodLabels,
): string {
  const start = startDate
    ? formatHistoricalDate(startDate, locale, labels)
    : undefined;
  const end = endDate
    ? formatHistoricalDate(endDate, locale, labels)
    : undefined;
  if (start && end) return labels.range(start, end);
  if (start) return startDate?.qualifier ? start : labels.from(start);
  if (end)
    return endDate?.qualifier ? labels.openStart(end) : labels.until(end);
  return labels.undated;
}

export type PartialDatePrecisionChoice = "none" | HistoricalDatePrecision;
export type PartialDateQualifierChoice = "exact" | HistoricalDateQualifier;

/** Form state for one partial date; every part is text until saved. */
export interface PartialDateDraft {
  precision: PartialDatePrecisionChoice;
  year: string;
  month: string;
  day: string;
  qualifier: PartialDateQualifierChoice;
  uncertain: boolean;
}

export const EMPTY_PARTIAL_DATE: PartialDateDraft = {
  precision: "none",
  year: "",
  month: "",
  day: "",
  qualifier: "exact",
  uncertain: false,
};

export function draftFromHistoricalDate(
  date: HistoricalDate | undefined,
): PartialDateDraft {
  if (!date) return EMPTY_PARTIAL_DATE;
  return {
    precision: date.precision,
    year: String(date.year),
    month: date.month === undefined ? "" : String(date.month),
    day: date.day === undefined ? "" : String(date.day),
    qualifier: date.qualifier ?? "exact",
    uncertain: date.uncertain === true,
  };
}

function wholeNumber(text: string, min: number, max: number) {
  if (!/^\d+$/.test(text.trim())) return undefined;
  const value = Number(text.trim());
  return value >= min && value <= max ? value : undefined;
}

/**
 * The date the draft states: `undefined` when not stated, `null` when its
 * parts are incomplete or out of range. Only the parts its precision names
 * are kept; the server checks the calendar.
 */
export function historicalDateFromDraft(
  draft: PartialDateDraft,
): HistoricalDate | undefined | null {
  if (draft.precision === "none") return undefined;
  const year = wholeNumber(draft.year, 1, 9999);
  if (year === undefined) return null;
  if (draft.precision === "decade" && year % 10 !== 0) return null;
  const needsMonth = draft.precision === "day" || draft.precision === "month";
  const month = needsMonth ? wholeNumber(draft.month, 1, 12) : undefined;
  if (needsMonth && month === undefined) return null;
  const day =
    draft.precision === "day" ? wholeNumber(draft.day, 1, 31) : undefined;
  if (draft.precision === "day" && day === undefined) return null;
  return {
    precision: draft.precision,
    year,
    month,
    day,
    qualifier: draft.qualifier === "exact" ? undefined : draft.qualifier,
    uncertain: draft.uncertain ? true : undefined,
  };
}
