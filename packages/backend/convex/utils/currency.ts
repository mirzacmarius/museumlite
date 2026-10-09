import { v } from "convex/values";
import { valuationError } from "./valuationErrors";

/**
 * Circulating ISO 4217 currencies accepted for new monetary records. Fund,
 * precious-metal and testing codes are excluded. Values are never converted
 * between currencies; amounts in different currencies are reported apart.
 */
const ISO_4217_CURRENCIES = new Set(
  [
    "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF",
    "BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC",
    "CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS",
    "GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD",
    "JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL",
    "LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD",
    "NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD",
    "RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP",
    "SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES",
    "VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG",
  ]
    .join(" ")
    .split(" "),
);

/** The ISO code for a recognised currency, or null. */
export function normalizeCurrency(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const code = raw.trim().toUpperCase();
  return ISO_4217_CURRENCIES.has(code) ? code : null;
}

/** The ISO code for `raw`; rejects anything that is not a recognised currency. */
export function requireCurrencyCode(raw: string) {
  const code = normalizeCurrency(raw);
  if (!code) {
    throw valuationError("INVALID_CURRENCY", `Unrecognised currency: ${raw}`);
  }
  return code;
}

/** Rejects negative, infinite or NaN monetary amounts. */
export function requireAmount(value: number | undefined, label: string) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw valuationError("INVALID_AMOUNT", `${label} must be zero or more`);
  }
}

/**
 * Grouping key for stored currency text. Recognised codes group by ISO code;
 * legacy free text keeps its own trimmed, upper-cased group so it is never
 * merged into a real currency.
 */
export function currencyGroupKey(raw: string) {
  return normalizeCurrency(raw) ?? raw.trim().toUpperCase();
}

export const currencyTotalValidator = v.object({
  currency: v.string(),
  total: v.number(),
  count: v.number(),
});

export const currencyTotalsValidator = v.object({
  byCurrency: v.array(currencyTotalValidator),
  /** Records with no recognised currency; their amounts are not summed. */
  currencyNotRecordedCount: v.number(),
});

export interface CurrencyTotals {
  byCurrency: Array<{ currency: string; total: number; count: number }>;
  currencyNotRecordedCount: number;
}

/** Accumulates amounts per currency without ever adding across currencies. */
export class CurrencyTotalsBuilder {
  private readonly totals = new Map<string, { total: number; count: number }>();
  private notRecorded = 0;

  add(currency: string | undefined, amount: number) {
    const code = normalizeCurrency(currency);
    if (code === null) {
      this.notRecorded += 1;
      return;
    }
    const entry = this.totals.get(code) ?? { total: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    this.totals.set(code, entry);
  }

  build(): CurrencyTotals {
    return {
      byCurrency: [...this.totals.entries()]
        .map(([currency, entry]) => ({ currency, ...entry }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
      currencyNotRecordedCount: this.notRecorded,
    };
  }
}
