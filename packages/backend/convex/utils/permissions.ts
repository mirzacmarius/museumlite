import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Get the current user's organization context
 * Returns the userOrganization record for the user in the given organization
 */
export async function getCurrentUserOrganization(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  const userOrganization = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  return userOrganization;
}

/**
 * Get user's role in an organization
 */
export async function getUserRole(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const userOrganization = await getCurrentUserOrganization(ctx, organizationId);
  if (!userOrganization) {
    return null;
  }

  const role = await ctx.db.get(userOrganization.roleId);
  return role;
}

/**
 * Get all permissions for a user in an organization
 */
export async function getUserPermissions(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string[]> {
  const role = await getUserRole(ctx, organizationId);
  if (!role) {
    return [];
  }

  const rolePermissions = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q) => q.eq("roleId", role._id))
    .collect();

  const permissions = await Promise.all(
    rolePermissions.map((rp) => ctx.db.get(rp.permissionId)),
  );

  return permissions
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => p.name);
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permissionName: string,
): Promise<boolean> {
  const permissions = await getUserPermissions(ctx, organizationId);
  return permissions.includes(permissionName);
}

/**
 * Assert that user has permission, throw error if not
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permissionName: string,
): Promise<void> {
  const has = await hasPermission(ctx, organizationId, permissionName);
  if (!has) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
}

/**
 * Check if user can access a resource (has read permission or owns it)
 */
export async function canAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  action: "read" | "write" | "delete",
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return false;
  }

  // Check if user is in organization
  const userOrganization = await getCurrentUserOrganization(
    ctx,
    organizationId,
  );
  if (!userOrganization) {
    return false;
  }

  // Map action to permission name
  const permissionMap: Record<string, string> = {
    read: "collections.read",
    write: "collections.update",
    delete: "collections.delete",
  };

  const permissionName = permissionMap[action] || "collections.read";
  return await hasPermission(ctx, organizationId, permissionName);
}

/**
 * Check if user can initiate a workflow
 */
export async function canInitiateWorkflow(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: "accession" | "deaccession",
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return false;
  }

  const userOrganization = await getCurrentUserOrganization(
    ctx,
    organizationId,
  );
  if (!userOrganization) {
    return false;
  }

  // Get workflow config
  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .filter((q) => q.eq(q.field("workflowType"), workflowType))
    .first();

  if (!workflowConfig) {
    // No config means anyone with basic permissions can initiate
    return await hasPermission(ctx, organizationId, "collections.create");
  }

  // Check if user's role is in canInitiateRoles
  return workflowConfig.canInitiateRoles.includes(userOrganization.roleId);
}

/**
 * Check if user can approve at a specific workflow step
 */
export async function canApproveAtStep(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: "accession" | "deaccession",
  stepNumber: number,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return false;
  }

  const userOrganization = await getCurrentUserOrganization(
    ctx,
    organizationId,
  );
  if (!userOrganization) {
    return false;
  }

  // Get workflow config
  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .filter((q) => q.eq(q.field("workflowType"), workflowType))
    .first();

  if (!workflowConfig) {
    // No config means only admins/curators can approve
    return await hasPermission(
      ctx,
      organizationId,
      workflowType === "accession"
        ? "collections.approve_accession"
        : "collections.approve_deaccession",
    );
  }

  // Find the step
  const step = workflowConfig.steps.find(
    (s) => s.stepNumber === stepNumber,
  );

  if (!step) {
    return false;
  }

  // Check if user's role matches the step's required role
  return step.roleId === userOrganization.roleId;
}

/**
 * Get users who should be notified for a workflow step
 * Returns users with the required role for the next step
 */
export async function getUsersToNotifyForWorkflowStep(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: "accession" | "deaccession",
  stepNumber: number,
): Promise<Id<"users">[]> {
  // Get workflow config
  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .filter((q) => q.eq(q.field("workflowType"), workflowType))
    .first();

  if (!workflowConfig) {
    // No workflow config - notify all users with approval permission
    const permissionName =
      workflowType === "accession"
        ? "collections.approve_accession"
        : "collections.approve_deaccession";

    // Get all users in organization
    const userOrgs = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    const userIds: Id<"users">[] = [];
    for (const userOrg of userOrgs) {
      const role = await ctx.db.get(userOrg.roleId);
      if (!role) continue;

      const rolePermissions = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", role._id))
        .collect();

      const permissions = await Promise.all(
        rolePermissions.map((rp) => ctx.db.get(rp.permissionId)),
      );

      const permissionNames = permissions
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map((p) => p.name);

      if (permissionNames.includes(permissionName)) {
        userIds.push(userOrg.userId);
      }
    }

    return userIds;
  }

  // Find the step
  const step = workflowConfig.steps.find(
    (s) => s.stepNumber === stepNumber,
  );

  if (!step) {
    return [];
  }

  // Get all users with the required role
  const userOrgs = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  const userIds: Id<"users">[] = [];
  for (const userOrg of userOrgs) {
    if (userOrg.roleId === step.roleId) {
      userIds.push(userOrg.userId);
    }
  }

  return userIds;
}

