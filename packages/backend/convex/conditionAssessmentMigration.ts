import { v } from "convex/values";
import { internalMutation } from "./utils/mutationBuilders";
import { SUPER_ADMIN_ROLE_NAME } from "./utils/superAdmins";
import {
  ADMIN_ROLE_NAME,
  COLLECTION_MANAGER_ROLE_NAME,
  CURATOR_ROLE_NAME,
  SYSTEM_ROLE_DEFINITIONS,
} from "./utils/systemRoles";

// Current and legacy names (e.g. "registrar") of the roles that review condition.
const REVIEWER_ROLE_NAMES = new Set([
  SUPER_ADMIN_ROLE_NAME,
  ...SYSTEM_ROLE_DEFINITIONS.flatMap((definition) =>
    [ADMIN_ROLE_NAME, CURATOR_ROLE_NAME, COLLECTION_MANAGER_ROLE_NAME].includes(
      definition.name,
    )
      ? definition.recognizedNames
      : [],
  ),
]);

export const grantReviewPermission = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Organization not found");
    const name = "collections.accept_condition";
    const collectionPermissions = await ctx.db
      .query("permissions")
      .withIndex("by_category", (q) => q.eq("category", "collections"))
      .take(100);
    const existing = collectionPermissions.find(
      (permission) => permission.name === name,
    );
    const permissionId =
      existing?._id ??
      (await ctx.db.insert("permissions", {
        name,
        category: "collections",
        description: "Accept retained object condition assessments",
      }));
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(101);
    if (roles.length > 100)
      throw new Error(
        "Too many roles; migrate this organization in smaller batches",
      );
    for (const role of roles) {
      if (!role.isSystemRole || !REVIEWER_ROLE_NAMES.has(role.name)) continue;
      const grants = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", role._id))
        .take(101);
      if (grants.length > 100)
        throw new Error(
          "Too many grants; migrate this role in smaller batches",
        );
      if (!grants.some((grant) => grant.permissionId === permissionId)) {
        await ctx.db.insert("rolePermissions", {
          roleId: role._id,
          permissionId,
        });
      }
    }
    return null;
  },
});
