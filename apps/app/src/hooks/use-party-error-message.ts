import {
  type PartyErrorCode,
  partyErrorFromError,
} from "@v1/backend/convex/utils/partyErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates party link and review failures. Any other failure gets the
 * translated fallback; server error text is never shown.
 */
export function usePartyErrorMessage() {
  const t = useScopedI18n("parties.errors");
  function codeMessage(code: PartyErrorCode) {
    switch (code) {
      case "PARTY_NOT_FOUND":
        return t("partyNotFound");
      case "PARTY_ARCHIVED":
        return t("partyArchived");
      case "PARTY_ROLE_NOT_ALLOWED":
        return t("roleNotAllowed");
      case "PARTY_TARGET_NOT_FOUND":
        return t("targetNotFound");
      case "PARTY_NAME_REQUIRED":
        return t("nameRequired");
      case "PARTY_DATES_INVALID":
        return t("datesInvalid");
      case "PARTY_LINK_NOT_FOUND":
        return t("linkNotFound");
      case "PARTY_LINK_ALREADY_SUPERSEDED":
        return t("linkAlreadySuperseded");
      case "DUPLICATE_REVIEW_NOT_FOUND":
        return t("reviewNotFound");
      case "DUPLICATE_REVIEW_ALREADY_RESOLVED":
        return t("reviewAlreadyResolved");
    }
  }

  return (error: unknown) => {
    const partyError = partyErrorFromError(error);
    return partyError ? codeMessage(partyError.code) : t("fallback");
  };
}
