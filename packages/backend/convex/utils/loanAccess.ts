import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireFeatureAccess } from "./featureGates";

export async function requireLoansAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireFeatureAccess(ctx, organizationId, "loans");
}
