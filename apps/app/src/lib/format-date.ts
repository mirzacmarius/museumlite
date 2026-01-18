import {
  type Locale,
  format as dateFnsFormat,
  formatDistanceToNow,
} from "date-fns";
import { enUS, es, fr, nb } from "date-fns/locale";

const localeMap: Record<string, Locale> = {
  en: enUS,
  es,
  fr,
  no: nb,
};

export function formatDate(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const intlLocale = locale === "no" ? "nb-NO" : locale;
  return date.toLocaleDateString(intlLocale, options);
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
