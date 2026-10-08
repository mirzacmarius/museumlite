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

function isDateLocale(locale: string): locale is DateLocale {
  return (
    locale === "en" ||
    locale === "es" ||
    locale === "fr" ||
    locale === "no" ||
    locale === "ro"
  );
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
