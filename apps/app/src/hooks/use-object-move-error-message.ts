import { identifierErrorFromError } from "@v1/backend/convex/utils/identifierErrors";
import {
  type EligibilityBlockerCode,
  objectMoveErrorFromError,
} from "@v1/backend/convex/utils/objectMoveErrors";
import { useScopedI18n } from "@/locales/client";
import { useActionErrorMessage } from "./use-action-error-message";
import { useIdentifierErrorMessage } from "./use-identifier-error-message";

/** Why an object cannot be transferred to the chosen organization right now. */
export function useMoveBlockerMessage() {
  const t = useScopedI18n("moveRequests.blockers");
  const tErrors = useScopedI18n("moveRequests.errors");
  return (code: EligibilityBlockerCode): string => {
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
      case "collection_not_found":
        return t("collectionNotFound");
      case "target_not_accepting_transfers":
        return t("targetNotAcceptingTransfers");
      case "target_not_in_hierarchy":
        return tErrors("outsideHierarchy");
      case "hierarchy_plan_required":
        return tErrors("planRequired");
      case "target_membership_required":
        return t("targetMembershipRequired");
      case "target_create_permission_required":
        return t("targetCreatePermissionRequired");
    }
  };
}

/**
 * Explains why a transfer request or decision failed, in the app's language:
 * coded move request refusals first, then refusals of the receiver's new
 * number, then the shared action refusals such as missing permissions and
 * custody conflicts, then the caller's translated fallback. Server error text
 * is never shown.
 */
export function useObjectMoveErrorMessage() {
  const t = useScopedI18n("moveRequests.errors");
  const blockerMessage = useMoveBlockerMessage();
  const identifierMessage = useIdentifierErrorMessage();
  const actionMessage = useActionErrorMessage();
  /** Number refusals in the transfer's own words where it has them. */
  const numberMessage = (error: unknown): string | null => {
    const refusal = identifierErrorFromError(error);
    switch (refusal?.code) {
      case "IDENTIFIER_IN_USE":
        return t("accessionNumberTaken", { number: refusal.identifier ?? "" });
      case "NUMBERING_NOT_CONFIGURED":
        return t("accessionGenerationUnavailable");
      default:
        return identifierMessage(error);
    }
  };
  return (error: unknown, fallback: string): string => {
    const refusal = objectMoveErrorFromError(error);
    switch (refusal?.code) {
      case "MOVE_REQUEST_CLOSED":
        return t("requestClosed");
      case "TRANSFER_AWAITS_SENDER":
        return t("awaitsSender");
      case "MOVE_BLOCKED": {
        const reasons = (refusal.blockers ?? []).map(blockerMessage);
        return reasons.length > 0 ? reasons.join(" ") : fallback;
      }
      case "DESTINATION_OUTSIDE_HIERARCHY":
        return t("outsideHierarchy");
      case "DESTINATION_NOT_ACCEPTING":
        return t("destinationNotAccepting");
      case "HIERARCHY_PLAN_REQUIRED":
        return t("planRequired");
      case "ACCESSION_NUMBER_REQUIRED":
        return t("accessionNumberRequired");
      case "SOURCE_LOCATION_CHANGED":
        return t("sourceLocationChanged");
      case undefined:
        return numberMessage(error) ?? actionMessage(error, fallback);
    }
  };
}
