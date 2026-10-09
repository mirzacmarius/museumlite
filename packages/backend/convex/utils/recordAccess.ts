import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { type FeatureId, hasFeatureAccess } from "./featureGates";
import { getCurrentUserOrganization, hasPermission } from "./permissions";

/**
 * Stable code for a record the caller's organization holds but the caller's
 * role may not read. Clients map it to translated copy; `message` is English
 * for logs only.
 */
export const RECORD_FORBIDDEN = "RECORD_FORBIDDEN";

// Type aliases (not interfaces) so the payloads satisfy Convex's Value type.
export type RecordForbiddenData = {
  code: typeof RECORD_FORBIDDEN;
  message: string;
};

/** The capability-error payload clients already read for plan-gated features. */
export type RecordFeatureUnavailableData = {
  code: "CAPABILITY_UNAVAILABLE";
  reason: "tier_required";
  message: string;
};

/**
 * Decides whether a detail read may return a record of `organizationId`.
 *
 * Returns `false` when the caller is signed out or not a member, so another
 * organization's identifier reads exactly like a missing one. A member whose
 * role lacks `permission` gets a RECORD_FORBIDDEN error, and a member of an
 * organization whose plan lacks `feature` gets a CAPABILITY_UNAVAILABLE error.
 */
export async function canReadRecord(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  permission: string,
  options: { feature?: FeatureId } = {},
): Promise<boolean> {
  const membership = await getCurrentUserOrganization(ctx, organizationId);
  if (!membership) return false;
  if (
    options.feature &&
    !(await hasFeatureAccess(ctx, organizationId, options.feature))
  ) {
    const unavailable: RecordFeatureUnavailableData = {
      code: "CAPABILITY_UNAVAILABLE",
      reason: "tier_required",
      message: `Feature ${options.feature} is not included in this plan`,
    };
    throw new ConvexError(unavailable);
  }
  if (await hasPermission(ctx, organizationId, permission)) return true;
  const data: RecordForbiddenData = {
    code: RECORD_FORBIDDEN,
    message: `Permission denied: ${permission}`,
  };
  throw new ConvexError(data);
}
