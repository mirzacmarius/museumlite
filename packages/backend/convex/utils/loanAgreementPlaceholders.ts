/**
 * The placeholder vocabulary for loan agreement templates. Templates are
 * validated against it when saved, and the app renders the same tokens, so a
 * saved template never contains a placeholder the renderer cannot fill.
 */
export const LOAN_AGREEMENT_PLACEHOLDERS = [
  "loan.number",
  "loan.startDate",
  "loan.endDate",
  "loan.currency",
  "loan.terms",
  "lender.name",
  "borrower.name",
  "organization.name",
  "object.list",
  "object.count",
  "insurance.value",
] as const;

export type LoanAgreementPlaceholder =
  (typeof LOAN_AGREEMENT_PLACEHOLDERS)[number];

export type LoanAgreementTemplateToken =
  | { kind: "text"; text: string }
  | { kind: "placeholder"; name: LoanAgreementPlaceholder };

export type LoanAgreementTemplateParseResult =
  | { ok: true; tokens: LoanAgreementTemplateToken[] }
  | { ok: false; problem: "UNKNOWN_PLACEHOLDER"; placeholder: string }
  | { ok: false; problem: "MALFORMED_PLACEHOLDER" };

const PLACEHOLDER_PATTERN = /\{\{([^{}\n]*)\}\}/g;

function isLoanAgreementPlaceholder(
  name: string,
): name is LoanAgreementPlaceholder {
  return (LOAN_AGREEMENT_PLACEHOLDERS as readonly string[]).includes(name);
}

function hasStrayBraces(text: string) {
  return text.includes("{{") || text.includes("}}");
}

/**
 * Splits template text into literal text and `{{placeholder}}` tokens.
 * Whitespace inside the braces is ignored; a placeholder cannot span lines.
 */
export function parseLoanAgreementTemplateText(
  text: string,
): LoanAgreementTemplateParseResult {
  const tokens: LoanAgreementTemplateToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const before = text.slice(cursor, match.index);
    if (hasStrayBraces(before)) {
      return { ok: false, problem: "MALFORMED_PLACEHOLDER" };
    }
    if (before) tokens.push({ kind: "text", text: before });
    const name = (match[1] ?? "").trim();
    if (!name) return { ok: false, problem: "MALFORMED_PLACEHOLDER" };
    if (!isLoanAgreementPlaceholder(name)) {
      return { ok: false, problem: "UNKNOWN_PLACEHOLDER", placeholder: name };
    }
    tokens.push({ kind: "placeholder", name });
    cursor = match.index + match[0].length;
  }
  const rest = text.slice(cursor);
  if (hasStrayBraces(rest)) {
    return { ok: false, problem: "MALFORMED_PLACEHOLDER" };
  }
  if (rest) tokens.push({ kind: "text", text: rest });
  return { ok: true, tokens };
}
