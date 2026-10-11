import {
  type ReproductionErrorCode,
  reproductionErrorCodeFromError,
} from "@v1/backend/convex/utils/reproductionRequestErrors";
import { useScopedI18n } from "@/locales/client";
import { useCapabilityErrorMessage } from "./use-capability-error-message";

/**
 * Translates Reproduction request failures and capability refusals. Any
 * other failure gets the translated fallback; server text is never shown.
 */
export function useReproductionErrorMessage() {
  const t = useScopedI18n("reproductionRequests.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  function codeMessage(code: ReproductionErrorCode) {
    switch (code) {
      case "REQUEST_NOT_FOUND":
        return t("requestNotFound");
      case "OBJECT_UNAVAILABLE":
        return t("objectUnavailable");
      case "IMAGE_NOT_ELIGIBLE":
        return t("imageNotEligible");
      case "IMAGE_SOURCE_UNVERIFIED":
        return t("imageSourceUnverified");
      case "REQUESTER_EMAIL_MISSING":
        return t("requesterEmailMissing");
      case "PURPOSE_REQUIRED":
        return t("purposeRequired");
      case "SUMMARY_REQUIRED":
        return t("summaryRequired");
      case "TEXT_TOO_LONG":
        return t("textTooLong");
      case "REQUEST_NOT_OPEN":
        return t("requestNotOpen");
      case "EVIDENCE_NOT_FOUND":
        return t("evidenceNotFound");
      case "EVIDENCE_DOCUMENT_INVALID":
        return t("evidenceDocumentInvalid");
      case "EVIDENCE_REQUIRED":
        return t("evidenceRequired");
      case "DERIVATIVE_IN_PROGRESS":
        return t("derivativeInProgress");
      case "DERIVATIVE_NOT_READY":
        return t("derivativeNotReady");
      case "TERMS_NOT_PUBLISHED":
        return t("termsNotPublished");
      case "TERMS_OUTDATED":
        return t("termsOutdated");
      case "TERMS_TEXT_REQUIRED":
        return t("termsTextRequired");
      case "EXPIRY_INVALID":
        return t("expiryInvalid");
      case "REASON_REQUIRED":
        return t("reasonRequired");
      case "GRANT_NOT_ACTIVE":
        return t("grantNotActive");
      case "DELIVERY_NOT_RETRYABLE":
        return t("deliveryNotRetryable");
      case "EMAIL_CHANNEL_UNAVAILABLE":
        return t("emailChannelUnavailable");
    }
  }

  return (error: unknown) => {
    const code = reproductionErrorCodeFromError(error);
    if (code) return codeMessage(code);
    return capabilityMessage(error) ?? t("fallback");
  };
}
