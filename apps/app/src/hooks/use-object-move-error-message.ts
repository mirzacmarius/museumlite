import {
  type MoveBlockerCode,
  objectMoveErrorFromError,
} from "@v1/backend/convex/utils/objectMoveErrors";
import { useScopedI18n } from "@/locales/client";
import { useActionErrorMessage } from "./use-action-error-message";

/** Why an object cannot be transferred to another organization right now. */
export function useMoveBlockerMessage() {
  const t = useScopedI18n("moveRequests.blockers");
  return (code: MoveBlockerCode): string => {
    switch (code) {
      case "status_not_active":
        return t("statusNotActive");
      case "same_organization":
        return t("sameOrganization");
      case "active_loan":
        return t("activeLoan");
      case "pending_location_move":
        return t("pendingLocationMove");
      case "pending_organization_move":
        return t("pendingOrganizationMove");
      case "temporary_custody":
        return t("temporaryCustody");
      case "has_parent_object":
        return t("hasParentObject");
      case "has_child_objects":
        return t("hasChildObjects");
      case "active_transit":
        return t("activeTransit");
      case "active_exhibition":
        return t("activeExhibition");
      case "has_deaccessions":
        return t("hasDeaccessions");
      case "insurance_coverage":
        return t("insuranceCoverage");
      case "insurance_claim":
        return t("insuranceClaim");
    }
  };
}

/**
 * Explains why a move request decision failed, in the app's language: coded
 * move request refusals first, then the shared action refusals such as
 * missing permissions and custody conflicts, then the caller's translated
 * fallback. Server error text is never shown.
 */
export function useObjectMoveErrorMessage() {
  const t = useScopedI18n("moveRequests.errors");
  const blockerMessage = useMoveBlockerMessage();
  const actionMessage = useActionErrorMessage();
  return (error: unknown, fallback: string): string => {
    const refusal = objectMoveErrorFromError(error);
    switch (refusal?.code) {
      case "MOVE_REQUEST_CLOSED":
        return t("requestClosed");
      case "MOVE_BLOCKED": {
        const reasons = (refusal.blockers ?? []).map(blockerMessage);
        return reasons.length > 0 ? reasons.join(" ") : fallback;
      }
      case "DESTINATION_OUTSIDE_HIERARCHY":
        return t("outsideHierarchy");
      case "HIERARCHY_PLAN_REQUIRED":
        return t("planRequired");
      case undefined:
        return actionMessage(error, fallback);
    }
  };
}
