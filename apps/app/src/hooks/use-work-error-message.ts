import { workErrorFromError } from "@v1/backend/convex/utils/workErrors";
import { useScopedI18n } from "@/locales/client";
import { useCapabilityErrorMessage } from "./use-capability-error-message";

/**
 * Translates case task failures and capability refusals. Any other failure
 * gets the translated fallback; server error text is never shown.
 */
export function useWorkErrorMessage() {
  const t = useScopedI18n("caseTasks.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  const evidenceRequiredMessage = (kind: string | undefined) => {
    switch (kind) {
      case "conditionAssessment":
        return t("evidenceRequired.conditionAssessment");
      case "media":
        return t("evidenceRequired.media");
      case "movement":
        return t("evidenceRequired.movement");
      default:
        return t("evidenceRequired.auditEntry");
    }
  };
  return (error: unknown) => {
    const data = workErrorFromError(error);
    if (!data) return capabilityMessage(error) ?? t("fallback");
    switch (data.code) {
      case "CASE_NOT_FOUND":
        return t("caseNotFound");
      case "TASK_NOT_FOUND":
        return t("taskNotFound");
      case "ASSIGNEE_NOT_ELIGIBLE":
        return t("assigneeNotEligible");
      case "REVIEWER_NOT_ELIGIBLE":
        return t("reviewerNotEligible");
      case "DEPENDENCY_INVALID":
        return t("dependencyInvalid");
      case "DEPENDENCIES_OPEN":
        return t("dependenciesOpen", { count: data.openCount ?? 1 });
      case "STATUS_CHANGED":
        return t("statusChanged");
      case "REVIEW_REQUIRED":
        return t("reviewRequired");
      case "REVIEWER_ONLY":
        return t("reviewerOnly");
      case "EVIDENCE_NOT_FOUND":
        return t("evidenceNotFound");
      case "LIMIT_REACHED":
        return t("limitReached");
      case "INVALID_INPUT":
        return t("invalidInput");
      case "EVIDENCE_REQUIRED":
        return evidenceRequiredMessage(data.evidenceKind);
      case "CASE_NOT_ACCEPTED":
        return t("caseNotAccepted");
      case "RECIPE_NOT_FOUND":
        return t("recipeNotFound");
      case "RECIPE_INVALID":
        return t("recipeInvalid");
      case "INCIDENT_NOT_FOUND":
        return t("incidentNotFound");
      case "NOT_INCIDENT_COORDINATOR":
        return t("notIncidentCoordinator");
      case "NOT_INCIDENT_RESPONDER":
        return t("notIncidentResponder");
      case "OBJECT_NOT_AFFECTED":
        return t("objectNotAffected");
      case "PLAN_NOT_AVAILABLE":
        return t("planNotAvailable");
      case "TASKS_OPEN":
        return t("tasksOpen", { count: data.openCount ?? 1 });
    }
  };
}
