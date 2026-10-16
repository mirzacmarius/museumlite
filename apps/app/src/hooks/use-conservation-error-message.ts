import {
  type ConservationErrorCode,
  conservationErrorFromError,
} from "@v1/backend/convex/utils/conservationErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Copy for a conservation treatment workflow refusal, such as approving
 * without a baseline assessment. The evidence panel also shows it before
 * staff click, for the step a treatment is waiting on.
 */
export function useConservationErrorCopy() {
  const t = useScopedI18n("conservation.evidence.errors");
  return (code: ConservationErrorCode) => {
    switch (code) {
      case "TREATMENT_BASELINE_REQUIRED":
        return t("baselineRequired");
      case "TREATMENT_OUTCOME_REQUIRED":
        return t("outcomeRequired");
      case "TREATMENT_OUTCOME_NOT_ACCEPTED":
        return t("outcomeNotAccepted");
      case "TREATMENT_STATUS_CHANGED":
        return t("statusChanged");
    }
  };
}

/**
 * Translates conservation treatment workflow refusals. Returns null for any
 * other failure so callers keep their own handling.
 */
export function useConservationErrorMessage() {
  const copy = useConservationErrorCopy();
  return (error: unknown): string | null => {
    const refusal = conservationErrorFromError(error);
    return refusal ? copy(refusal.code) : null;
  };
}
