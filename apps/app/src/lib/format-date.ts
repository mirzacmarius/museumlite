import {
  format as dateFnsFormat,
  formatDistanceToNow,
  type Locale,
} from "date-fns";
import { enUS, es, fr, nb, ro } from "date-fns/locale";

const localeMap: Record<string, Locale> = {
  en: enUS,
  es,
  fr,
  no: nb,
  ro,
};
type DateLocale = "en" | "es" | "fr" | "no" | "ro";

const UTC_DATE_TIME_FORMATTERS: Record<DateLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  es: new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  fr: new Intl.DateTimeFormat("fr", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  no: new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
  ro: new Intl.DateTimeFormat("ro", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }),
};

const SCHEDULE_WEEKDAY_FORMATTERS: Record<DateLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }),
  es: new Intl.DateTimeFormat("es", { weekday: "long", timeZone: "UTC" }),
  fr: new Intl.DateTimeFormat("fr", { weekday: "long", timeZone: "UTC" }),
  no: new Intl.DateTimeFormat("nb-NO", { weekday: "long", timeZone: "UTC" }),
  ro: new Intl.DateTimeFormat("ro", { weekday: "long", timeZone: "UTC" }),
};

/** Days of a weekly schedule as reports and digests store them; 0 is Sunday. */
export const SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Name of a weekly schedule day in the app locale. */
export function formatScheduleWeekday(day: number, locale: string): string {
  const supportedLocale = isDateLocale(locale) ? locale : "en";
  // 1 January 2023 was a Sunday.
  return SCHEDULE_WEEKDAY_FORMATTERS[supportedLocale].format(
    Date.UTC(2023, 0, 1 + day),
  );
}

function isDateLocale(locale: string): locale is DateLocale {
  return (
    locale === "en" ||
    locale === "es" ||
    locale === "fr" ||
    locale === "no" ||
    locale === "ro"
  );
}

/**
 * Display options for calendar dates entered as `yyyy-MM-dd` and stored at
 * UTC midnight, so they show the same day in every time zone.
 */
export const CALENDAR_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  dateStyle: "medium",
};

const PARTIAL_MONTH_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
};

/**
 * A date a Partial date field stores (`yyyy`, `yyyy-MM` or `yyyy-MM-dd`) in
 * the app language, to the precision it was entered. Other text is returned
 * as written.
 */
export function formatPartialDate(value: string, locale: string): string {
  const text = value.trim();
  const match = text.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!match) return text;
  const [, year, month, day] = match;
  if (month === undefined) return year ?? text;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day ?? 1));
  // A month or day the calendar does not have is shown as written.
  if (
    date.getUTCMonth() !== Number(month) - 1 ||
    (day !== undefined && date.getUTCDate() !== Number(day))
  ) {
    return text;
  }
  return formatDate(
    date,
    locale,
    day === undefined ? PARTIAL_MONTH_OPTIONS : CALENDAR_DATE_OPTIONS,
  );
}

/**
 * Last month date pickers offer for future dates such as policy expiries,
 * coverage ends and appraisal validity: December, ten years ahead.
 */
export function futureCalendarEndMonth() {
  return new Date(new Date().getFullYear() + 10, 11, 1);
}

export function formatDate(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const intlLocale = locale === "no" ? "nb-NO" : locale;
  // toLocaleDateString rejects timeStyle; date-and-time styles need toLocaleString.
  if (options?.timeStyle) {
    return date.toLocaleString(intlLocale, options);
  }
  return date.toLocaleDateString(intlLocale, options);
}

export function formatTime(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const intlLocale = locale === "no" ? "nb-NO" : locale;
  return date.toLocaleTimeString(intlLocale, options);
}

export function formatDateTimeUtc(timestamp: number, locale: string): string {
  const supportedLocale = isDateLocale(locale) ? locale : "en";
  return UTC_DATE_TIME_FORMATTERS[supportedLocale].format(timestamp);
}

export function formatIsoTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function formatDateFns(
  date: Date,
  formatStr: string,
  locale: string,
): string {
  return dateFnsFormat(date, formatStr, {
    locale: localeMap[locale] || enUS,
  });
}

export function formatDistanceLocale(
  date: Date,
  locale: string,
  options?: { addSuffix?: boolean },
): string {
  return formatDistanceToNow(date, {
    locale: localeMap[locale] || enUS,
    addSuffix: options?.addSuffix ?? true,
  });
}
