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
