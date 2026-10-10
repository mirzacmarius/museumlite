import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { CapabilityId } from "./capabilities";
import {
  getCurrentUserOrganization,
  requireCapability,
  requirePermission,
} from "./permissions";

/**
 * Decides whether a detail read may return a record of `organizationId`.
 *
 * Returns `false` when the caller is signed out or not a member, so another
 * organization's identifier reads exactly like a missing one. Members go
 * through the usual gates, which refuse with a coded CAPABILITY_UNAVAILABLE
 * error naming the missing dimension (permission, module or plan).
 */
export async function canReadRecord(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  permission: string | readonly string[],
  options: { capability?: CapabilityId } = {},
): Promise<boolean> {
  const membership = await getCurrentUserOrganization(ctx, organizationId);
  if (!membership) return false;
  if (options.capability) {
    await requireCapability(
      ctx,
      organizationId,
      options.capability,
      permission,
    );
  } else {
    for (const name of typeof permission === "string"
      ? [permission]
      : permission)
      await requirePermission(ctx, organizationId, name);
  }
  return true;
}
