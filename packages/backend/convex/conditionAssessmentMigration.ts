import { v } from "convex/values";
import { internalMutation } from "./utils/mutationBuilders";
import {
  grantPermissionToSystemRoles,
  REVIEWER_SYSTEM_ROLE_NAMES,
} from "./utils/systemRoleGrants";

export const grantReviewPermission = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await grantPermissionToSystemRoles(ctx, {
      organizationId: args.organizationId,
      name: "collections.accept_condition",
      description: "Accept retained object condition assessments",
      roleNames: REVIEWER_SYSTEM_ROLE_NAMES,
    });
    return null;
  },
});
