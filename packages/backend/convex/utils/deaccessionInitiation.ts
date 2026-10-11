import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  type CapabilityState,
  capabilityStateError,
  evaluateCapability,
} from "./capabilities";
import { organizationAccess } from "./featureGates";
import { getRolePermissionNames } from "./permissions";
import { getWorkflowConfig } from "./workflowConfigs";

/** Logged permission for refusals; the rule is not a single permission. */
export const DEACCESSION_INITIATION_PERMISSION =
  "cannot initiate deaccession workflow";

/** Permissions that start a deaccession when no approval workflow applies. */
const INITIATE_WITHOUT_WORKFLOW = ["collections.create", "collections.delete"];

/**
 * Whether a member may start a deaccession, single or bulk, as a state of the
 * `deaccession` capability. Organization administrators always may, as they
 * may approve any step. Otherwise the approval workflow's initiating roles
 * decide when a workflow applies, and `collections.create` or
 * `collections.delete` when none does. Null for non-members.
 */
export async function deaccessionInitiationState(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
): Promise<CapabilityState | null> {
  const [membership, organization] = await Promise.all([
    ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", userId).eq("organizationId", organizationId),
      )
      .first(),
    ctx.db.get(organizationId),
  ]);
  if (!membership || !organization) return null;

  const access = organizationAccess(organization);
  const entitlement = evaluateCapability("deaccession", access, [], []);
  if (entitlement.status !== "available") return entitlement;

  const permissions = await getRolePermissionNames(ctx, membership.roleId);
  const workflowConfig =
    (organization.settings?.deaccessionWorkflowEnabled ?? true)
      ? await getWorkflowConfig(ctx, organizationId, "deaccession")
      : null;
  const allowed =
    permissions.includes("organization.manage_settings") ||
    (workflowConfig
      ? workflowConfig.canInitiateRoles.includes(membership.roleId)
      : INITIATE_WITHOUT_WORKFLOW.some((name) => permissions.includes(name)));

  return allowed
    ? entitlement
    : { ...entitlement, status: "permission_missing" };
}

/**
 * Throws unless the member may start a deaccession: the coded capability
 * failure for members, the legacy plain error for anyone else.
 */
export async function requireDeaccessionInitiation(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const state = await deaccessionInitiationState(ctx, organizationId, userId);
  if (!state) {
    throw new Error(`Permission denied: ${DEACCESSION_INITIATION_PERMISSION}`);
  }
  const error = capabilityStateError(state, DEACCESSION_INITIATION_PERMISSION);
  if (error) throw error;
}
