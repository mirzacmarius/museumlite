import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireCapabilityEntitlement } from "./featureGates";

export async function requireLoansAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  await requireCapabilityEntitlement(ctx, organizationId, "loans");
}
