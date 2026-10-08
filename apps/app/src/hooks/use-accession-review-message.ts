import { accessionReviewErrorFromError } from "@v1/backend/convex/utils/accessionReview";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates accession review decision errors (reject, restore). Any other
 * failure gets the translated fallback; server error text is never shown.
 */
export function useAccessionReviewMessage() {
  const t = useScopedI18n("accessionReview.errors");

  return (error: unknown) => {
    switch (accessionReviewErrorFromError(error)?.code) {
      case "NOT_IN_REVIEW":
        return t("notInReview");
      case "NOT_WITHDRAWN":
        return t("notWithdrawn");
      case "REASON_REQUIRED":
        return t("reasonRequired");
      case "NOT_PERMITTED":
        return t("notPermitted");
      default:
        return t("fallback");
    }
  };
}
