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

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "NOK"] as const;
for (const locale of Object.keys(LOCALE_MAP) as Locale[]) {
  for (const currency of COMMON_CURRENCIES) {
    CURRENCY_FORMATTERS.set(
      `${locale}:${currency}`,
      new Intl.NumberFormat(LOCALE_MAP[locale], {
        style: "currency",
        currency,
      }),
    );
  }
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
  const formatter = CURRENCY_FORMATTERS.get(`${locale}:${currency}`);
  if (formatter) {
    return formatter.format(value);
  }

  return value.toLocaleString(LOCALE_MAP[locale], {
    style: "currency",
    currency,
  });
}

/**
 * Formats an amount in its recorded currency. Without a currency the bare
 * number is returned so callers can label it "currency not recorded"; a
 * currency code the runtime cannot format is shown after the number.
 */
export function formatMoney(
  value: number,
  locale: Locale,
  currency: string | null | undefined,
): string {
  if (!currency) return formatNumber(value, locale);
  try {
    return formatCurrency(value, locale, currency);
  } catch {
    return `${formatNumber(value, locale)} ${currency}`;
  }
}

/**
 * Totals per recorded currency, sorted by currency code. Amounts in different
 * currencies are never added together; an amount without a currency is
 * counted in `currencyNotRecordedCount`, not summed.
 */
export function totalsByCurrency(
  entries: ReadonlyArray<{ amount?: number | null; currency?: string | null }>,
): {
  byCurrency: Array<{ currency: string; total: number }>;
  currencyNotRecordedCount: number;
} {
  const totals = new Map<string, number>();
  let currencyNotRecordedCount = 0;
  for (const { amount, currency } of entries) {
    if (amount === undefined || amount === null) continue;
    if (!currency) {
      currencyNotRecordedCount++;
      continue;
    }
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return {
    byCurrency: [...totals]
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    currencyNotRecordedCount,
  };
}
