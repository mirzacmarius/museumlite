import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery } from "../_generated/server";
import { batchGetByIds } from "./batchLookup";
import {
  type CapabilityId,
  capabilityOfPermission,
  capabilityStateError,
  capabilityUnavailable,
  evaluateCapability,
  evaluateCapabilityEntitlement,
  permissionMissingMessage,
} from "./capabilities";
import {
  type ModuleId,
  organizationAccess,
  requireModuleEnabled,
} from "./featureGates";
import { VALUATION_PERMISSION } from "./valuation";
import { workflowApprovalError } from "./workflowApprovalErrors";
import {
  getWorkflowConfig,
  isDeaccessionWorkflowEnabled,
} from "./workflowConfigs";
import { resolveWorkflowStepState } from "./workflowSteps";

/**
 * Returns user IDs in an organization whose role includes the given permission.
 */
export async function getUserIdsWithPermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permissionName: string,
  options?: { excludeUserId?: Id<"users"> },
): Promise<Id<"users">[]> {
  const members = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const matchingUserIds = await Promise.all(
    members.map(async (member) => {
      if (options?.excludeUserId && member.userId === options.excludeUserId) {
        return null;
      }

      const rolePerms = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", member.roleId))
        .collect();

      if (rolePerms.length === 0) {
        return null;
      }

      const permissions = await batchGetByIds(
        ctx,
        rolePerms.map((rp) => rp.permissionId),
        "permissions",
      );

      const hasMatch = permissions.some(
        (permission) => permission?.name === permissionName,
      );

      return hasMatch ? member.userId : null;
    }),
  );

  return matchingUserIds.flatMap((userId) => (userId === null ? [] : [userId]));
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
  return getRolePermissionNames(ctx, role._id);
}

/** Permission names granted to a role. */
export async function getRolePermissionNames(
  ctx: QueryCtx | MutationCtx,
  roleId: Id<"roles">,
): Promise<string[]> {
  const rolePermissions = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q) => q.eq("roleId", roleId))
    .collect();

  const permissions = await Promise.all(
    rolePermissions.map((rp) => ctx.db.get(rp.permissionId)),
  );

  return permissions.flatMap((permission) =>
    permission === null ? [] : [permission.name],
  );
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permissionName: string,
): Promise<boolean> {
  const capability = capabilityOfPermission(permissionName);
  if (capability) {
    const organization = await ctx.db.get(organizationId);
    if (
      !organization ||
      evaluateCapabilityEntitlement(
        capability,
        organizationAccess(organization),
      ).status !== "available"
    ) {
      return false;
    }
  }
  const permissions = await getUserPermissions(ctx, organizationId);
  return permissions.includes(permissionName);
}

/**
 * Assert that user has permission, throw error if not
 */
export async function requireModuleAndPermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  moduleId: ModuleId,
  permissionName: string,
): Promise<void> {
  await Promise.all([
    requireModuleEnabled(ctx, organizationId, moduleId),
    requirePermission(ctx, organizationId, permissionName),
  ]);
}

export async function requireLocationAdminPermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permission: "locations.create" | "locations.update" | "locations.delete",
): Promise<void> {
  await Promise.all([
    requirePermission(ctx, organizationId, permission),
    requirePermission(ctx, organizationId, "organization.manage_settings"),
  ]);
}

/**
 * A Permission that belongs to a capability goes through `requireCapability`,
 * so its module and plan come from the matrix in ADR 0004's order. Any other
 * Permission needs only the role.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  permissionName: string,
): Promise<void> {
  const capability = capabilityOfPermission(permissionName);
  if (capability) {
    await requireCapability(ctx, organizationId, capability, permissionName);
    return;
  }
  const permissions = await getUserPermissions(ctx, organizationId);
  if (!permissions.includes(permissionName)) {
    throw permissionDenied(permissionName);
  }
}

export async function requireValuationRead(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  await Promise.all([
    requirePermission(ctx, organizationId, "collections.read"),
    requirePermission(ctx, organizationId, VALUATION_PERMISSION),
  ]);
}

function permissionDenied(permissionName: string) {
  return capabilityUnavailable({
    reason: "permission_missing",
    message: permissionMissingMessage(permissionName),
  });
}

/**
 * Gate for a command that belongs to a capability in the capability matrix,
 * in the same order as the navigation states: membership first, so
 * non-members get the uncoded refusal and learn nothing about the
 * organization; then the module, the command's permission and the plan.
 */
export async function requireCapability(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  capability: CapabilityId,
  permission: string | readonly string[],
): Promise<void> {
  const required: readonly string[] =
    typeof permission === "string" ? [permission] : permission;
  const membership = await getCurrentUserOrganization(ctx, organizationId);
  if (!membership) {
    throw new Error(permissionMissingMessage(required[0] ?? capability));
  }
  const [organization, permissions] = await Promise.all([
    ctx.db.get(organizationId),
    getRolePermissionNames(ctx, membership.roleId),
  ]);
  if (!organization) {
    throw new Error("Organization not found");
  }
  const missing =
    required.find((name) => !permissions.includes(name)) ?? required[0];
  const error = capabilityStateError(
    evaluateCapability(
      capability,
      organizationAccess(organization),
      permissions,
      required,
    ),
    missing ?? capability,
  );
  if (error) throw error;
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

  // Organization administrators may start any workflow, as they may approve
  // any step (see canApproveAtStep).
  if (
    await hasPermission(ctx, organizationId, "organization.manage_settings")
  ) {
    return true;
  }

  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization_and_workflowType", (q) =>
      q.eq("organizationId", organizationId).eq("workflowType", workflowType),
    )
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

  // Organization administrators are allowed to override workflow step roles.
  if (
    await hasPermission(ctx, organizationId, "organization.manage_settings")
  ) {
    return true;
  }

  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization_and_workflowType", (q) =>
      q.eq("organizationId", organizationId).eq("workflowType", workflowType),
    )
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

  if (step.roleId === userOrganization.roleId) {
    return true;
  }
  return false;
}

export type ApprovalCaseType = Exclude<WorkflowType, "acquisition">;

const APPROVE_COMMAND_PERMISSIONS = {
  accession: {
    name: "collections.approve_accession",
    requiredWithWorkflow: true,
  },
  deaccession: {
    name: "collections.approve_deaccession",
    requiredWithWorkflow: true,
  },
  loan: { name: "loans.approve", requiredWithWorkflow: true },
  exhibition: { name: "collections.update", requiredWithWorkflow: false },
  conservation: { name: "collections.update", requiredWithWorkflow: false },
} satisfies Record<
  ApprovalCaseType,
  { name: string; requiredWithWorkflow: boolean }
>;

export async function resolveCaseApproval(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  caseType: ApprovalCaseType,
  workflowStep: number | undefined,
) {
  const permission = APPROVE_COMMAND_PERMISSIONS[caseType];
  const config =
    caseType === "deaccession" &&
    !(await isDeaccessionWorkflowEnabled(ctx, organizationId))
      ? null
      : await getWorkflowConfig(ctx, organizationId, caseType);
  if (
    (permission.requiredWithWorkflow || !config) &&
    !(await hasPermission(ctx, organizationId, permission.name))
  ) {
    return {
      allowed: false as const,
      refusal: permissionDenied(permission.name),
    };
  }
  if (!config) {
    return { allowed: true as const, workflow: null };
  }

  const state = resolveWorkflowStepState(config.steps, workflowStep);
  const currentStep = state.currentStep;
  if (currentStep === undefined) {
    return {
      allowed: false as const,
      refusal: workflowApprovalError(
        "WORKFLOW_NOT_CONFIGURED",
        "Workflow has no approval steps configured",
      ),
    };
  }
  if (!state.hasCurrentStep && !state.isPastLastStep) {
    return {
      allowed: false as const,
      refusal: workflowApprovalError(
        "WORKFLOW_NOT_CONFIGURED",
        "Current workflow step is not configured",
      ),
    };
  }
  if (!(await canApproveAtStep(ctx, organizationId, caseType, currentStep))) {
    return {
      allowed: false as const,
      refusal: workflowApprovalError(
        "APPROVAL_NOT_PERMITTED",
        "Permission denied: cannot approve at this step",
      ),
    };
  }
  return { allowed: true as const, workflow: { config, state, currentStep } };
}

/**
 * Internal query: returns true if the given user is a member of the organization.
 * For use from action context (actions have no ctx.db access).
 */
export const checkOrgMembership = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();
    return member !== null;
  },
});

/**
 * Internal query: returns true if the given user has a specific named permission
 * in the organization.  For use from action context.
 */
export const checkOrgPermission = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    permissionName: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userOrg = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();
    if (!userOrg) return false;

    const rolePerms = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", userOrg.roleId))
      .collect();
    if (rolePerms.length === 0) return false;

    const permissions = await Promise.all(
      rolePerms.map((rp) => ctx.db.get(rp.permissionId)),
    );
    return permissions.some((p) => p?.name === args.permissionName);
  },
});

export async function getUsersToNotifyForWorkflowStep(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  workflowType: WorkflowType,
  stepNumber: number,
): Promise<Id<"users">[]> {
  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization_and_workflowType", (q) =>
      q.eq("organizationId", organizationId).eq("workflowType", workflowType),
    )
    .first();

  if (!workflowConfig) {
    const permissionName = getApprovalPermissionForWorkflow(workflowType);
    return getUserIdsWithPermission(ctx, organizationId, permissionName);
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
