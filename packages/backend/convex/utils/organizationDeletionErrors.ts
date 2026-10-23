import { ConvexError } from "convex/values";
import { convexErrorData as errorData } from "./convexErrorData";

/**
 * Stable codes for Organization deletion and ownership refusals staff can act
 * on. Clients map these to translated copy; `message` is English for logs
 * only.
 */
export const ORGANIZATION_DELETION_CODES = [
  /** The Organization holds permanent museum evidence. */
  "EVIDENCE_PROTECTED",
  "SUB_ORGANIZATION",
  /** No deletion is running, or it has already finished or been cancelled. */
  "NO_ACTIVE_DELETION",
  "ALREADY_OWNER",
  "NEW_OWNER_NOT_SUPER_ADMIN",
  "NEW_OWNER_NOT_MEMBER",
] as const;

export type OrganizationDeletionCode =
  (typeof ORGANIZATION_DELETION_CODES)[number];

// Type alias (not an interface) so the payload satisfies Convex's Value type.
export type OrganizationDeletionErrorData = {
  code: OrganizationDeletionCode;
  message: string;
};

const MESSAGES: Record<OrganizationDeletionCode, string> = {
  EVIDENCE_PROTECTED:
    "Permanent evidence cannot be deleted. Withdraw the object from the catalog to archive it; retained records and originals remain available for review and restore.",
  SUB_ORGANIZATION: "Sub-organizations cannot be deleted from this screen",
  NO_ACTIVE_DELETION: "No active deletion process found",
  ALREADY_OWNER: "You are already the organization owner",
  NEW_OWNER_NOT_SUPER_ADMIN:
    "Ownership can only be transferred to another SuperAdmin",
  NEW_OWNER_NOT_MEMBER: "New owner must be a member of the organization",
};

export function organizationDeletionError(
  code: OrganizationDeletionCode,
): ConvexError<OrganizationDeletionErrorData> {
  return new ConvexError({ code, message: MESSAGES[code] });
}

/** Reads a deletion refusal from a thrown error; null for any other failure. */
export function organizationDeletionErrorFromError(
  error: unknown,
): OrganizationDeletionErrorData | null {
  const data = errorData(error);
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }
  const code = ORGANIZATION_DELETION_CODES.find(
    (candidate) => candidate === data.code,
  );
  if (!code) return null;
  return { code, message: MESSAGES[code] };
}
