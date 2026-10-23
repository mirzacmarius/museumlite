import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Stable codes for scheduled report refusals staff can act on. Clients map
 * these to translated copy; `message` is English for logs only.
 */
export const REPORTING_ERROR_CODES = [
  "REPORT_NAME_INVALID",
  /** Only operational KPI snapshots can be generated. */
  "REPORT_GENERATOR_UNAVAILABLE",
  /** A legacy report carries date ranges, filters or delivery settings. */
  "REPORT_CONFIG_UNSUPPORTED",
  "REPORT_ALREADY_RUNNING",
  "REPORT_RUN_NOT_RETRYABLE",
] as const;

export type ReportingErrorCode = (typeof REPORTING_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ReportingErrorData = {
  code: ReportingErrorCode;
  message: string;
};

const MESSAGES: Record<ReportingErrorCode, string> = {
  REPORT_NAME_INVALID: "Enter a report name of 1–200 characters",
  REPORT_GENERATOR_UNAVAILABLE:
    "Report generator unavailable. Only operational KPIs are supported.",
  REPORT_CONFIG_UNSUPPORTED:
    "KPI reports are current snapshots. Date ranges, filters, comparisons and email delivery are unavailable; clear the legacy configuration to retry.",
  REPORT_ALREADY_RUNNING: "Report is already running",
  REPORT_RUN_NOT_RETRYABLE: "This run cannot be retried",
};

export function reportingError(
  code: ReportingErrorCode,
): ConvexError<ReportingErrorData> {
  return new ConvexError({ code, message: MESSAGES[code] });
}

/** Reads a report refusal from a thrown error; null for any other failure. */
export function reportingErrorFromError(
  error: unknown,
): ReportingErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = REPORTING_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  return { code, message: MESSAGES[code] };
}
