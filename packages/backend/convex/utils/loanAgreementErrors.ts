import { ConvexError } from "convex/values";

/**
 * Stable codes for loan agreement template and loan currency problems that
 * staff can fix. Clients map these to translated copy; `message` is English
 * for logs only.
 */
export const LOAN_AGREEMENT_TEMPLATE_ERROR_CODES = [
  "TEMPLATE_NOT_FOUND",
  "TEMPLATE_ARCHIVED",
  "NAME_REQUIRED",
  "SECTIONS_REQUIRED",
  "TEMPLATE_TOO_LARGE",
  "UNKNOWN_PLACEHOLDER",
  "MALFORMED_PLACEHOLDER",
  "INVALID_CURRENCY",
] as const;

export type LoanAgreementTemplateErrorCode =
  (typeof LOAN_AGREEMENT_TEMPLATE_ERROR_CODES)[number];

// Type alias (not interface) so the payload satisfies Convex's Value type.
export type LoanAgreementTemplateErrorData = {
  code: LoanAgreementTemplateErrorCode;
  message: string;
  /** The offending placeholder name, for UNKNOWN_PLACEHOLDER. */
  placeholder?: string;
};

export function loanAgreementTemplateError(
  code: LoanAgreementTemplateErrorCode,
  message: string,
  details: { placeholder?: string } = {},
): ConvexError<LoanAgreementTemplateErrorData> {
  const data: LoanAgreementTemplateErrorData = { code, message };
  if (details.placeholder !== undefined) data.placeholder = details.placeholder;
  return new ConvexError(data);
}

function convexErrorData(error: unknown): unknown {
  if (
    typeof error !== "object" ||
    error === null ||
    !(
      error instanceof ConvexError ||
      ("name" in error && error.name === "ConvexError")
    ) ||
    !("data" in error)
  ) {
    return undefined;
  }
  if (typeof error.data !== "string") return error.data;
  try {
    return JSON.parse(error.data);
  } catch {
    return undefined;
  }
}

/** Reads a loan agreement template error from a thrown error; null otherwise. */
export function loanAgreementTemplateErrorFromError(
  error: unknown,
): LoanAgreementTemplateErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = LOAN_AGREEMENT_TEMPLATE_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const record = data as Record<string, unknown>;
  return {
    code,
    message: typeof record.message === "string" ? record.message : code,
    placeholder:
      typeof record.placeholder === "string" ? record.placeholder : undefined,
  };
}
