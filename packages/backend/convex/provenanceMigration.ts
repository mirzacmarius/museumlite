import { v } from "convex/values";
import { internalMutation } from "./utils/mutationBuilders";
import { PROVENANCE_REVIEW_PERMISSION } from "./utils/provenance";
import {
  grantPermissionToSystemRoles,
  REVIEWER_SYSTEM_ROLE_NAMES,
} from "./utils/systemRoleGrants";

/** Grants provenance review to one organization's reviewer system roles. */
export const grantReviewPermission = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await grantPermissionToSystemRoles(ctx, {
      organizationId: args.organizationId,
      name: PROVENANCE_REVIEW_PERMISSION,
      description: "Accept, dispute or reject provenance claims",
      roleNames: REVIEWER_SYSTEM_ROLE_NAMES,
    });
    return null;
  },
});
