import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Permission names granted by a role. */
export async function rolePermissionNames(ctx: QueryCtx, roleId: Id<"roles">) {
  const rolePermissions = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .take(500);
  const permissions = await Promise.all(
    rolePermissions.map((row) => ctx.db.get(row.permissionId)),
  );
  return new Set(permissions.flatMap((row) => (row ? [row.name] : [])));
}

/**
 * Permission names another user holds in an organization, or null when they
 * are not a member. Use it to vet assignees, never to authorize the caller.
 */
export async function memberPermissionNames(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const membership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();
  if (!membership) return null;
  return await rolePermissionNames(ctx, membership.roleId);
}
