import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getCurrentUserOrganization,
  getRolePermissionNames,
  requireCapability,
} from "./permissions";
import { reproductionError } from "./reproductionRequestErrors";

type ReadCtx = QueryCtx | MutationCtx;

/** Reading a request shows the image record and the requester Party. */
export const REPRODUCTION_READ_PERMISSIONS = [
  "media.read",
  "accounts.read",
] as const;

/** Intake, evidence and derivatives are media work. */
export const REPRODUCTION_PREPARE_PERMISSIONS = [
  ...REPRODUCTION_READ_PERMISSIONS,
  "media.upload",
] as const;

/** Decisions, revocation and delivery use the public-approval authority. */
export const REPRODUCTION_DECIDE_PERMISSIONS = [
  ...REPRODUCTION_READ_PERMISSIONS,
  "organization.manage_settings",
] as const;

export type ReproductionAccess = "read" | "prepare" | "decide";

const PERMISSIONS: Record<ReproductionAccess, readonly string[]> = {
  read: REPRODUCTION_READ_PERMISSIONS,
  prepare: REPRODUCTION_PREPARE_PERMISSIONS,
  decide: REPRODUCTION_DECIDE_PERMISSIONS,
};

export async function requireReproductionAccess(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  access: ReproductionAccess,
) {
  await requireCapability(
    ctx,
    organizationId,
    "reproduction_requests",
    PERMISSIONS[access],
  );
}

/**
 * Loads a request for a command. A missing request and one in another
 * organization read the same, so identifiers reveal nothing.
 */
export async function requireReproductionRequest(
  ctx: ReadCtx,
  requestId: Id<"reproductionRequests">,
  access: ReproductionAccess,
): Promise<Doc<"reproductionRequests">> {
  const request = await ctx.db.get(requestId);
  if (
    !request ||
    !(await getCurrentUserOrganization(ctx, request.organizationId))
  ) {
    throw reproductionError("REQUEST_NOT_FOUND", "Request not found");
  }
  await requireReproductionAccess(ctx, request.organizationId, access);
  return request;
}

/** Which of the caller's commands the request screen may offer. */
export async function reproductionCommands(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  const membership = await getCurrentUserOrganization(ctx, organizationId);
  const permissions = membership
    ? await getRolePermissionNames(ctx, membership.roleId)
    : [];
  const holds = (required: readonly string[]) =>
    required.every((permission) => permissions.includes(permission));
  return {
    canPrepare: holds(REPRODUCTION_PREPARE_PERMISSIONS),
    canDecide: holds(REPRODUCTION_DECIDE_PERMISSIONS),
  };
}

const MEMBER_SCAN_LIMIT = 500;

/** Current members whose role holds every permission needed to decide. */
export async function reproductionDeciders(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  const memberships = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(MEMBER_SCAN_LIMIT);
  const rolePermissions = new Map<Id<"roles">, readonly string[]>();
  const deciders: Array<Id<"users">> = [];
  for (const membership of memberships) {
    let permissions = rolePermissions.get(membership.roleId);
    if (!permissions) {
      permissions = await getRolePermissionNames(ctx, membership.roleId);
      rolePermissions.set(membership.roleId, permissions);
    }
    if (
      REPRODUCTION_DECIDE_PERMISSIONS.every((permission) =>
        permissions.includes(permission),
      )
    )
      deciders.push(membership.userId);
  }
  return deciders;
}
