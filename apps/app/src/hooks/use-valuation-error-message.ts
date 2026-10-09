import {
  type ValuationErrorCode,
  valuationErrorFromError,
} from "@v1/backend/convex/utils/valuationErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates valuation and insurance coverage errors. Any other failure gets
 * the translated fallback; server error text is never shown.
 */
export function useValuationErrorMessage() {
  const t = useScopedI18n("valuation.errors");
  const messages: Record<ValuationErrorCode, string> = {
    INVALID_CURRENCY: t("INVALID_CURRENCY"),
    INVALID_AMOUNT: t("INVALID_AMOUNT"),
    INVALID_DATE: t("INVALID_DATE"),
    APPRAISER_REQUIRED: t("APPRAISER_REQUIRED"),
    REASON_REQUIRED: t("REASON_REQUIRED"),
    REFERENCE_NOT_FOUND: t("REFERENCE_NOT_FOUND"),
    APPRAISAL_ALREADY_SUPERSEDED: t("APPRAISAL_ALREADY_SUPERSEDED"),
    APPRAISAL_SUPERSEDED: t("APPRAISAL_SUPERSEDED"),
    APPRAISAL_NOT_FOR_COVERED_OBJECT: t("APPRAISAL_NOT_FOR_COVERED_OBJECT"),
    APPRAISAL_CURRENCY_MISMATCH: t("APPRAISAL_CURRENCY_MISMATCH"),
    CURRENT_APPRAISAL_REQUIRED: t("CURRENT_APPRAISAL_REQUIRED"),
    POLICY_NUMBER_TAKEN: t("POLICY_NUMBER_TAKEN"),
    INVALID_POLICY_PERIOD: t("INVALID_POLICY_PERIOD"),
    POLICY_NOT_IN_FORCE: t("POLICY_NOT_IN_FORCE"),
    INVALID_COVERAGE_PERIOD: t("INVALID_COVERAGE_PERIOD"),
    COVERAGE_OUTSIDE_POLICY_PERIOD: t("COVERAGE_OUTSIDE_POLICY_PERIOD"),
    COVERAGE_TARGET_NOT_FOUND: t("COVERAGE_TARGET_NOT_FOUND"),
    LEGACY_REVIEW_RESOLVED: t("LEGACY_REVIEW_RESOLVED"),
    LEGACY_REVIEW_TARGET_INVALID: t("LEGACY_REVIEW_TARGET_INVALID"),
  };

  return (error: unknown, fallback?: string) => {
    const data = valuationErrorFromError(error);
    if (data) return messages[data.code];
    return fallback ?? t("fallback");
  };
}
