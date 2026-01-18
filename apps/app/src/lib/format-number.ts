/**
 * Locale-aware number and currency formatting utilities.
 *
 * Maps app locale codes to Intl API locale strings and provides
 * type-safe formatting functions.
 */

type Locale = "en" | "fr" | "es" | "no";

/**
 * Maps app locale codes to Intl API locale strings.
 * Norwegian "no" -> "nb-NO" (Norwegian Bokmål)
 */
const LOCALE_MAP: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  no: "nb-NO", // Norwegian Bokmål
};

/**
 * Formats a number with locale-specific thousand separators and decimals.
 *
 * @example
 * formatNumber(1234.56, "en") // "1,234.56"
 * formatNumber(1234.56, "no") // "1 234,56"
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale]).format(value);
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
  return new Intl.NumberFormat(LOCALE_MAP[locale], {
    style: "currency",
    currency,
  }).format(value);
}
