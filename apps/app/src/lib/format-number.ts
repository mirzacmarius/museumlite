/**
 * Locale-aware number and currency formatting utilities.
 *
 * Maps app locale codes to Intl API locale strings and provides
 * type-safe formatting functions.
 */

export type FormatLocale = "en" | "fr" | "es" | "no" | "ro";

type Locale = FormatLocale;

/**
 * Maps app locale codes to Intl API locale strings.
 * Norwegian "no" -> "nb-NO" (Norwegian Bokmål)
 * Romanian "ro" -> "ro-RO"
 */
const LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  no: "nb-NO", // Norwegian Bokmål
  ro: "ro-RO", // Romanian
};

const NUMBER_FORMATTERS: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(LOCALE_MAP.en),
  fr: new Intl.NumberFormat(LOCALE_MAP.fr),
  es: new Intl.NumberFormat(LOCALE_MAP.es),
  no: new Intl.NumberFormat(LOCALE_MAP.no),
  ro: new Intl.NumberFormat(LOCALE_MAP.ro),
};

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();
function getCurrencyFormatter(locale: Locale, currency: string) {
  const key = `${locale}:${currency}`;
  let formatter = CURRENCY_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE_MAP[locale], {
      style: "currency",
      currency,
    });
    CURRENCY_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

/**
 * Formats a number with locale-specific thousand separators and decimals.
 *
 * @example
 * formatNumber(1234.56, "en") // "1,234.56"
 * formatNumber(1234.56, "no") // "1 234,56"
 */
export function formatNumber(value: number, locale: Locale): string {
  return NUMBER_FORMATTERS[locale].format(value);
}

/**
 * Formats a currency value with locale-specific formatting.
 *
 * @example
 * formatCurrency(1234.56, "en", "USD") // "$1,234.56"
 * formatCurrency(1234.56, "no", "NOK") // "1 234,56 kr"
 */
export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string,
): string {
  return getCurrencyFormatter(locale, currency).format(value);
}
