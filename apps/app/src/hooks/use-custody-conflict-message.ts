import {
  type CustodyConflictData,
  custodyConflictFromError,
} from "@v1/backend/convex/utils/custodyErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates custody conflicts from movement and handoff mutations. Any other
 * failure gets the translated fallback; server error text is never shown.
 */
export function useCustodyConflictMessage() {
  const t = useScopedI18n("custodyConflicts");
  function conflictMessage(conflict: CustodyConflictData) {
    const location = conflict.locationName;
    switch (conflict.code) {
      case "SOURCE_CHANGED":
        if (conflict.currentLocationName === null)
          return t("sourceChangedNoLocation");
        return conflict.currentLocationName
          ? t("sourceChanged", { location: conflict.currentLocationName })
          : t("sourceChangedUnknown");
      case "ALREADY_AT_DESTINATION":
        return t("alreadyAtDestination");
      case "DESTINATION_UNAVAILABLE":
        return location
          ? t("destinationUnavailable", { location })
          : t("destinationBlocked");
      case "DESTINATION_FULL":
        return location && conflict.capacity !== undefined
          ? t("destinationFull", { location, capacity: conflict.capacity })
          : t("destinationBlocked");
      case "DESTINATION_REQUIRED":
        return t("destinationRequired");
      case "EXTERNAL_CUSTODY":
        return t("externalCustody");
      case "ASSESSMENT_REQUIRED":
        return t("assessmentRequired");
      case "ASSESSMENT_NOT_ACCEPTED":
        return t("assessmentNotAccepted");
      case "CONDITION_EVIDENCE_REQUIRED":
        return t("conditionEvidenceRequired");
      case "REFERENCE_NOT_FOUND":
        return t("referenceNotFound");
      case "HANDOFF_ALREADY_RECORDED":
        return t("alreadyRecorded");
      case "HANDOFF_OUT_OF_ORDER":
        return t("outOfOrder");
      case "EXHIBITION_OUTCOME_UNRESOLVED":
        return t("exhibitionOutcomeUnresolved");
      case "CLOSURE_BLOCKED":
        return t("closureBlocked", { count: conflict.outstandingCount ?? 0 });
    }
  }

  return (error: unknown, fallback?: string) => {
    const conflict = custodyConflictFromError(error);
    if (conflict) return conflictMessage(conflict);
    return fallback ?? t("fallback");
  };
}
