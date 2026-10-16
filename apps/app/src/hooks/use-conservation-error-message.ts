import { conservationErrorFromError } from "@v1/backend/convex/utils/conservationErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates conservation treatment workflow refusals, such as approving
 * without a baseline assessment. Returns null for any other failure so
 * callers keep their own handling.
 */
export function useConservationErrorMessage() {
  const t = useScopedI18n("conservation.evidence.errors");
  return (error: unknown): string | null => {
    switch (conservationErrorFromError(error)?.code) {
      case "TREATMENT_BASELINE_REQUIRED":
        return t("baselineRequired");
      case "TREATMENT_OUTCOME_REQUIRED":
        return t("outcomeRequired");
      case "TREATMENT_OUTCOME_NOT_ACCEPTED":
        return t("outcomeNotAccepted");
      case "TREATMENT_STATUS_CHANGED":
        return t("statusChanged");
      case undefined:
        return null;
    }
  };
}
