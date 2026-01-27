import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  type FeatureId,
  hasFeatureAccess,
  requireFeatureAccess,
} from "./featureGates";

function getFeatureForPermission(permissionName: string): FeatureId | null {
  if (permissionName.startsWith("loans.")) {
    return "loans";
  }
  if (permissionName === "collections.approve_exhibition") {
    return "exhibitions";
  }
  if (permissionName === "collections.approve_conservation") {
    return "conservation";
  }
  return null;
}

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
  const userOrganization = await getCurrentUserOrganization(
    ctx,
    organizationId,
  );
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
  const feature = getFeatureForPermission(permissionName);
  if (feature) {
    const allowed = await hasFeatureAccess(ctx, organizationId, feature);
    if (!allowed) {
      return false;
    }
  }
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
  const feature = getFeatureForPermission(permissionName);
  if (feature) {
    await requireFeatureAccess(ctx, organizationId, feature);
  }
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

type WorkflowType =
  | "accession"
  | "deaccession"
  | "loan"
  | "acquisition"
  | "exhibition"
  | "conservation";

function getFallbackPermissionForWorkflow(workflowType: WorkflowType): string {
  switch (workflowType) {
    case "accession":
    case "deaccession":
    case "exhibition":
    case "conservation":
      return "collections.create";
    case "loan":
      return "loans.create";
    case "acquisition":
      return "collections.create";
  }
}

function getApprovalPermissionForWorkflow(workflowType: WorkflowType): string {
  switch (workflowType) {
    case "accession":
      return "collections.approve_accession";
    case "deaccession":
      return "collections.approve_deaccession";
    case "loan":
      return "loans.approve";
    case "acquisition":
      return "collections.approve_acquisition";
    case "exhibition":
      return "collections.approve_exhibition";
    case "conservation":
      return "collections.approve_conservation";
  }
}

export async function canInitiateWorkflow(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: WorkflowType,
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

  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("workflowType"), workflowType))
    .first();

  if (!workflowConfig) {
    return await hasPermission(
      ctx,
      organizationId,
      getFallbackPermissionForWorkflow(workflowType),
    );
  }

  return workflowConfig.canInitiateRoles.includes(userOrganization.roleId);
}

export async function canApproveAtStep(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: WorkflowType,
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

  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("workflowType"), workflowType))
    .first();

  if (!workflowConfig) {
    return await hasPermission(
      ctx,
      organizationId,
      getApprovalPermissionForWorkflow(workflowType),
    );
  }

  // Find the step
  const step = workflowConfig.steps.find((s) => s.stepNumber === stepNumber);

  if (!step) {
    return false;
  }

  // Check if user's role matches the step's required role
  return step.roleId === userOrganization.roleId;
}

export async function getUsersToNotifyForWorkflowStep(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: WorkflowType,
  stepNumber: number,
): Promise<Id<"users">[]> {
  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .filter((q) => q.eq(q.field("workflowType"), workflowType))
    .first();

  if (!workflowConfig) {
    const permissionName = getApprovalPermissionForWorkflow(workflowType);

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
  const step = workflowConfig.steps.find((s) => s.stepNumber === stepNumber);

  if (!step) {
    return [];
  }

  // Get all users with the required role
  const userOrgs = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const userIds: Id<"users">[] = [];
  for (const userOrg of userOrgs) {
    if (userOrg.roleId === step.roleId) {
      userIds.push(userOrg.userId);
    }
  }

  return userIds;
}
