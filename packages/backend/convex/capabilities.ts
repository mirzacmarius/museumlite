import { v } from "convex/values";
import { query } from "./_generated/server";
import { CAPABILITY_IDS, evaluateCapability } from "./utils/capabilities";
import { enabledModuleValidator } from "./utils/moduleValidators";
import {
  getCurrentUserOrganization,
  getUserPermissions,
} from "./utils/permissions";

const capabilityIdValidator = v.union(
  ...CAPABILITY_IDS.map((capability) => v.literal(capability)),
);

const tierValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("enterprise"),
);

const capabilityStateValidator = v.union(
  v.object({
    capability: capabilityIdValidator,
    status: v.literal("available"),
  }),
  v.object({
    capability: capabilityIdValidator,
    status: v.literal("module_disabled"),
    module: enabledModuleValidator,
  }),
  v.object({
    capability: capabilityIdValidator,
    status: v.literal("tier_required"),
    requiredTier: tierValidator,
  }),
  v.object({
    capability: capabilityIdValidator,
    status: v.literal("permission_missing"),
  }),
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
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) return null;
    const permissions = await getUserPermissions(ctx, args.organizationId);
    const access = {
      subscriptionTier: organization.subscriptionTier,
      enabledModules: organization.settings?.enabledModules,
      enabledIntegrations: organization.settings?.enabledIntegrations,
    };
    return CAPABILITY_IDS.map((capability) =>
      evaluateCapability(capability, access, permissions),
    );
  },
});
