import { capabilityUnavailableFromError } from "@v1/backend/convex/utils/capabilities";
import { partyErrorFromError } from "@v1/backend/convex/utils/partyErrors";
import {
  type ProvenanceErrorCode,
  provenanceErrorFromError,
} from "@v1/backend/convex/utils/provenanceErrors";
import { usePartyErrorMessage } from "@/hooks/use-party-error-message";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates provenance failures, including Party link refusals raised while
 * identifying a holder. Server error text is never shown.
 */
export function useProvenanceErrorMessage() {
  const t = useScopedI18n("provenance.errors");
  const partyErrorMessage = usePartyErrorMessage();
  function codeMessage(code: ProvenanceErrorCode) {
    switch (code) {
      case "PROVENANCE_OBJECT_NOT_FOUND":
        return t("objectNotFound");
      case "PROVENANCE_OBJECT_WITHDRAWN":
        return t("objectWithdrawn");
      case "PROVENANCE_CLAIM_NOT_FOUND":
        return t("claimNotFound");
      case "PROVENANCE_CLAIM_SUPERSEDED":
        return t("claimSuperseded");
      case "PROVENANCE_STATEMENT_REQUIRED":
        return t("statementRequired");
      case "PROVENANCE_PARTY_NAME_REQUIRED":
        return t("partyNameRequired");
      case "PROVENANCE_PARTY_INVALID":
        return t("partyInvalid");
      case "PROVENANCE_DATE_INVALID":
        return t("dateInvalid");
      case "PROVENANCE_DATE_ORDER_INVALID":
        return t("dateOrderInvalid");
      case "PROVENANCE_TEXT_TOO_LONG":
        return t("textTooLong");
      case "PROVENANCE_CONTRADICTION_INVALID":
        return t("contradictionInvalid");
      case "PROVENANCE_EVIDENCE_REQUIRED":
        return t("evidenceRequired");
      case "PROVENANCE_EVIDENCE_INVALID":
        return t("evidenceInvalid");
      case "PROVENANCE_EVIDENCE_LIMIT":
        return t("evidenceLimit");
      case "PROVENANCE_EVIDENCE_NOT_FOUND":
        return t("evidenceNotFound");
      case "PROVENANCE_EVIDENCE_RETRACTED":
        return t("evidenceRetracted");
      case "PROVENANCE_REASON_REQUIRED":
        return t("reasonRequired");
      case "PROVENANCE_REVIEW_NOTE_REQUIRED":
        return t("reviewNoteRequired");
    }
  }

  return (error: unknown) => {
    const provenanceError = provenanceErrorFromError(error);
    if (provenanceError) return codeMessage(provenanceError.code);
    if (partyErrorFromError(error)) return partyErrorMessage(error);
    if (capabilityUnavailableFromError(error)) return t("permission");
    return t("fallback");
  };
}
