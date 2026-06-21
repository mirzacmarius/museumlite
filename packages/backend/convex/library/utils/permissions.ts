import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { requireModuleEnabled } from "../../utils/featureGates";
import { requirePermission } from "../../utils/permissions";

export async function requireLibraryPermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permissionName: string,
): Promise<void> {
  await requireModuleEnabled(ctx, organizationId, "library");
  await requirePermission(ctx, organizationId, permissionName);
}
