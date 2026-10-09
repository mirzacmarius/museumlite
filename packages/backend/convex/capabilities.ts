import { v } from "convex/values";
import { query } from "./_generated/server";
import { CAPABILITY_IDS, evaluateCapability } from "./utils/capabilities";
import { organizationAccess } from "./utils/featureGates";
import { enabledModuleValidator } from "./utils/moduleValidators";
import {
  getCurrentUserOrganization,
  getRolePermissionNames,
} from "./utils/permissions";

const capabilityIdValidator = v.union(
  ...CAPABILITY_IDS.map((capability) => v.literal(capability)),
);

const tierValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("enterprise"),
);

const stateFields = {
  capability: capabilityIdValidator,
  listed: v.boolean(),
};

const capabilityStateValidator = v.union(
  v.object({ ...stateFields, status: v.literal("available") }),
  v.object({
    ...stateFields,
    status: v.literal("module_disabled"),
    module: enabledModuleValidator,
  }),
  v.object({
    ...stateFields,
    status: v.literal("tier_required"),
    requiredTier: tierValidator,
  }),
  v.object({ ...stateFields, status: v.literal("permission_missing") }),
);

/**
 * The caller's state for every capability in the active organization, with the
 * first missing dimension as the reason. Null for non-members.
 */
export const forOrganization = query({
  args: { organizationId: v.id("organizations") },
  returns: v.union(v.null(), v.array(capabilityStateValidator)),
  handler: async (ctx, args) => {
    const membership = await getCurrentUserOrganization(
      ctx,
      args.organizationId,
    );
    if (!membership) return null;
    const [organization, permissions] = await Promise.all([
      ctx.db.get(args.organizationId),
      getRolePermissionNames(ctx, membership.roleId),
    ]);
    if (!organization) return null;
    const access = organizationAccess(organization);
    return CAPABILITY_IDS.map((capability) =>
      evaluateCapability(capability, access, permissions),
    );
  },
});
