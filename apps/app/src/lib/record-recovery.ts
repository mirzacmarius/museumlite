import { capabilityUnavailableFromError } from "@v1/backend/convex/utils/capabilities";

/** Why a detail page cannot show its record, each with its own recovery. */
export type RecordRecoveryKind =
  | "missing"
  | "removed"
  | "forbidden"
  | "unavailable"
  | "error";

/**
 * Classifies an error thrown while reading a record for a detail page. Detail
 * reads answer non-members with "missing", so a coded capability refusal
 * always comes from the caller's own organization.
 */
export function recordErrorKind(
  error: unknown,
): Exclude<RecordRecoveryKind, "missing" | "removed"> {
  const refusal = capabilityUnavailableFromError(error);
  if (!refusal) return "error";
  return refusal.reason === "permission_missing" ? "forbidden" : "unavailable";
}

/**
 * The state of a reactive record read. A record that was shown and then
 * disappears was removed while open, which needs different copy from a link
 * that never resolved.
 */
export function recordViewState<Row>(
  record: Row | null | undefined,
  wasShown: boolean,
): "loading" | "ready" | "missing" | "removed" {
  if (record === undefined) return "loading";
  if (record === null) return wasShown ? "removed" : "missing";
  return "ready";
}
