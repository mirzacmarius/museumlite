import {
  type ConditionAssessmentErrorCode,
  conditionAssessmentErrorFromError,
} from "@v1/backend/convex/utils/conditionAssessmentErrors";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates condition assessment refusals and missing capabilities. Any
 * other failure gets the caller's translated fallback; server text is never
 * shown.
 */
export function useConditionAssessmentErrorMessage() {
  const t = useScopedI18n("conditionAssessments.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  const messages: Record<ConditionAssessmentErrorCode, string> = {
    ASSESSMENT_ALREADY_OPEN: t("ASSESSMENT_ALREADY_OPEN"),
    ASSESSMENT_NOT_DRAFT: t("ASSESSMENT_NOT_DRAFT"),
    ASSESSMENT_NOT_SUBMITTED: t("ASSESSMENT_NOT_SUBMITTED"),
    ASSESSMENT_ALREADY_DECIDED: t("ASSESSMENT_ALREADY_DECIDED"),
    ASSESSMENT_PHOTO_UNAVAILABLE: t("ASSESSMENT_PHOTO_UNAVAILABLE"),
    ASSESSMENT_EVIDENCE_UNAVAILABLE: t("ASSESSMENT_EVIDENCE_UNAVAILABLE"),
  };

  return (error: unknown, fallback: string) => {
    const data = conditionAssessmentErrorFromError(error);
    if (data) return messages[data.code];
    return capabilityMessage(error) ?? fallback;
  };
}
