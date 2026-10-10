import {
  type QualityErrorCode,
  qualityErrorFromError,
} from "@v1/backend/convex/utils/documentationQualityErrors";
import { useScopedI18n } from "@/locales/client";
import { useCapabilityErrorMessage } from "./use-capability-error-message";

/**
 * Translates documentation quality failures and capability refusals. Any
 * other failure gets the translated fallback; server text is never shown.
 */
export function useQualityErrorMessage() {
  const t = useScopedI18n("documentationQuality.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  function codeMessage(code: QualityErrorCode) {
    switch (code) {
      case "PROFILE_INVALID":
        return t("profileInvalid");
      case "PROFILE_LIMIT_REACHED":
        return t("profileLimitReached");
      case "PROFILE_NOT_FOUND":
        return t("profileNotFound");
      case "CHECK_RUNNING":
        return t("checkRunning");
      case "CHECK_NOT_FOUND":
        return t("checkNotFound");
      case "CHECK_NOT_RESUMABLE":
        return t("checkNotResumable");
      case "FINDING_NOT_FOUND":
        return t("findingNotFound");
      case "FINDING_STATUS_CHANGED":
        return t("findingStatusChanged");
      case "REVIEW_NOTE_REQUIRED":
        return t("reviewNoteRequired");
      case "IDENTIFIER_INDEX_INCOMPLETE":
        return t("identifierIndexIncomplete");
      case "DUPLICATE_GROUP_TOO_LARGE":
        return t("duplicateGroupTooLarge");
      case "REVIEWED_IN_IDENTIFIER_REGISTER":
        return t("reviewedInIdentifierRegister");
    }
  }

  return (error: unknown) => {
    const data = qualityErrorFromError(error);
    if (data) return codeMessage(data.code);
    return capabilityMessage(error) ?? t("fallback");
  };
}
