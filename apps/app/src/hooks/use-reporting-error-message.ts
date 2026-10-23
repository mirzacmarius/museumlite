import { reportingErrorFromError } from "@v1/backend/convex/utils/reportingErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates scheduled report refusals. Returns null for any other failure so
 * callers keep their own handling.
 */
export function useReportingErrorMessage() {
  const t = useScopedI18n("analytics.scheduledReports.refusals");
  return (error: unknown): string | null => {
    switch (reportingErrorFromError(error)?.code) {
      case "REPORT_NAME_INVALID":
        return t("nameInvalid");
      case "REPORT_GENERATOR_UNAVAILABLE":
        return t("generatorUnavailable");
      case "REPORT_CONFIG_UNSUPPORTED":
        return t("configUnsupported");
      case "REPORT_ALREADY_RUNNING":
        return t("alreadyRunning");
      case "REPORT_RUN_NOT_RETRYABLE":
        return t("runNotRetryable");
      case undefined:
        return null;
    }
  };
}
