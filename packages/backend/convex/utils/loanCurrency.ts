import { loanAgreementTemplateError } from "./loanAgreementErrors";

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/** True for a well-formed ISO 4217 code once trimmed and upper-cased. */
export function isLoanCurrencyCode(value: string) {
  return CURRENCY_CODE_PATTERN.test(value.trim().toUpperCase());
}

/**
 * Normalizes a loan currency to an upper-case ISO 4217 code ("nok" becomes
 * "NOK"). Blank input means no currency. Throws INVALID_CURRENCY otherwise.
 */
export function normalizeLoanCurrency(value: string): string | undefined {
  const code = value.trim().toUpperCase();
  if (!code) return undefined;
  if (!CURRENCY_CODE_PATTERN.test(code)) {
    throw loanAgreementTemplateError(
      "INVALID_CURRENCY",
      "Currency must be a three-letter ISO 4217 code",
    );
  }
  return code;
}
