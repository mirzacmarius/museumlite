import { accessionReviewErrorFromError } from "@v1/backend/convex/utils/accessionReview";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates accession review errors (reject, restore, approve, submit). Any
 * other failure gets the fallback; server error text is never shown.
 */
export function useAccessionReviewMessage() {
  const t = useScopedI18n("accessionReview.errors");

  return (error: unknown, fallback?: string) => {
    switch (accessionReviewErrorFromError(error)?.code) {
      case "NOT_IN_REVIEW":
        return t("notInReview");
      case "NOT_A_DRAFT":
        return t("notADraft");
      case "NOT_WITHDRAWN":
        return t("notWithdrawn");
      case "REASON_REQUIRED":
        return t("reasonRequired");
      case "REASON_TOO_LONG":
        return t("reasonTooLong");
      case "NOT_PERMITTED":
        return t("notPermitted");
      case undefined:
        return fallback ?? t("fallback");
    }
  };
}
