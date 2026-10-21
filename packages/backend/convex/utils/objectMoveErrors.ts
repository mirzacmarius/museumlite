import { ConvexError } from "convex/values";
import { convexErrorData } from "./convexErrorData";

/**
 * Why an object cannot be transferred to another organization right now.
 * Each is something staff resolve on the object before the transfer goes on.
 */
export const MOVE_BLOCKER_CODES = [
  "status_not_active",
  "same_organization",
  "active_loan",
  "pending_location_move",
  "pending_organization_move",
  "temporary_custody",
  "has_parent_object",
  "has_child_objects",
  "active_transit",
  "active_exhibition",
  "has_deaccessions",
  "insurance_coverage",
  "insurance_claim",
] as const;

/**
 * Why the chosen destination cannot take the object, found while staff fill
 * in a transfer request. The hierarchy codes draw the same line as the
 * DESTINATION_OUTSIDE_HIERARCHY and HIERARCHY_PLAN_REQUIRED refusals.
 */
export const TRANSFER_DESTINATION_BLOCKER_CODES = [
  "collection_not_found",
  "target_not_accepting_transfers",
  "target_not_in_hierarchy",
  "hierarchy_plan_required",
  "target_membership_required",
  "target_create_permission_required",
] as const;

/** Everything a transfer eligibility check can report. */
export const ELIGIBILITY_BLOCKER_CODES = [
  ...MOVE_BLOCKER_CODES,
  ...TRANSFER_DESTINATION_BLOCKER_CODES,
] as const;

export type EligibilityBlockerCode = (typeof ELIGIBILITY_BLOCKER_CODES)[number];

function isEligibilityBlockerCode(
  code: string,
): code is EligibilityBlockerCode {
  return ELIGIBILITY_BLOCKER_CODES.some((candidate) => candidate === code);
}

/**
 * Stable codes for move request refusals staff can act on. Clients map these
 * to translated copy; `message` is English for logs only.
 */
export const OBJECT_MOVE_ERROR_CODES = [
  /** Another decision already approved, executed, rejected or cancelled it. */
  "MOVE_REQUEST_CLOSED",
  /**
   * The receiving organization tried to decide a transfer that still waits
   * for the sending organization's approval, or its approval again.
   */
  "TRANSFER_AWAITS_SENDER",
  /** The object cannot move now; `blockers` says why. */
  "MOVE_BLOCKED",
  /**
   * The destination does not allow incoming transfer requests and is not in
   * the source organization's hierarchy.
   */
  "DESTINATION_OUTSIDE_HIERARCHY",
  /**
   * DESTINATION_OUTSIDE_HIERARCHY as the receiving organization reads it at
   * acceptance: it stopped allowing incoming transfer requests.
   */
  "DESTINATION_NOT_ACCEPTING",
  /** Transfers inside a hierarchy need its root organization on Pro or Enterprise. */
  "HIERARCHY_PLAN_REQUIRED",
  /**
   * The receiving organization chose to enter a number and left it blank.
   * A taken, invalid or ungenerated number is an identifier refusal
   * (`utils/identifierErrors.ts`), as on every other numbering path.
   */
  "ACCESSION_NUMBER_REQUIRED",
  /**
   * The object is no longer at the Location the sending organization approved
   * the transfer from, or the approval recorded none. The receiver declines,
   * and the sender can request the transfer again.
   */
  "SOURCE_LOCATION_CHANGED",
] as const;

export type ObjectMoveErrorCode = (typeof OBJECT_MOVE_ERROR_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type ObjectMoveErrorData = {
  code: ObjectMoveErrorCode;
  message: string;
  /** Set for MOVE_BLOCKED. */
  blockers?: EligibilityBlockerCode[];
};

export function objectMoveError(
  code: ObjectMoveErrorCode,
  message: string,
  blockers?: EligibilityBlockerCode[],
): ConvexError<ObjectMoveErrorData> {
  const data: ObjectMoveErrorData = { code, message };
  if (blockers !== undefined) data.blockers = blockers;
  const error = new ConvexError(data);
  error.message = message;
  return error;
}

/** Reads a move request refusal from a thrown error; null for any other failure. */
export function objectMoveErrorFromError(
  error: unknown,
): ObjectMoveErrorData | null {
  const data = convexErrorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = OBJECT_MOVE_ERROR_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  const message =
    "message" in data && typeof data.message === "string" ? data.message : code;
  if (code !== "MOVE_BLOCKED") return { code, message };
  const listed: unknown[] =
    "blockers" in data && Array.isArray(data.blockers) ? data.blockers : [];
  return {
    code,
    message,
    blockers: listed.filter(
      (blocker): blocker is EligibilityBlockerCode =>
        typeof blocker === "string" && isEligibilityBlockerCode(blocker),
    ),
  };
}
