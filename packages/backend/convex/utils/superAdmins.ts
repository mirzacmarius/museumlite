import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const SUPER_ADMIN_ROLE_NAME = "super_admin";

type OrgCtx = QueryCtx | MutationCtx;

export async function getSuperAdminRole(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("roles")
    .withIndex("by_organization_and_name", (q) =>
      q.eq("organizationId", organizationId).eq("name", SUPER_ADMIN_ROLE_NAME),
    )
    .first();
}

export async function getAdminRole(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("roles")
    .withIndex("by_organization_and_name", (q) =>
      q.eq("organizationId", organizationId).eq("name", "admin"),
    )
    .first();
}

async function getMembership(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();
}

export async function isUserSuperAdmin(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
): Promise<boolean> {
  const superAdminRole = await getSuperAdminRole(ctx, organizationId);
  if (superAdminRole) {
    const membership = await getMembership(ctx, organizationId, userId);
    if (membership?.roleId === superAdminRole._id) {
      return true;
    }
  }

  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    return false;
  }

  if (organization.ownerUserId === userId) {
    return true;
  }

  const adminRole = await getAdminRole(ctx, organizationId);
  if (!adminRole || superAdminRole) {
    return false;
  }

  const membership = await getMembership(ctx, organizationId, userId);
  return membership?.roleId === adminRole._id;
}

export async function listSuperAdminUserIds(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
): Promise<Array<Id<"users">>> {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    return [];
  }

  const superAdminRole = await getSuperAdminRole(ctx, organizationId);
  if (superAdminRole) {
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect();

    const superAdminIds = new Set<Id<"users">>();
    for (const membership of memberships) {
      if (membership.roleId === superAdminRole._id) {
        superAdminIds.add(membership.userId);
      }
    }

    if (organization.ownerUserId) {
      superAdminIds.add(organization.ownerUserId);
    }

    if (superAdminIds.size > 0) {
      return Array.from(superAdminIds);
    }
  }

  if (organization.ownerUserId) {
    return [organization.ownerUserId];
  }

  const adminRole = await getAdminRole(ctx, organizationId);
  if (!adminRole) {
    return [];
  }

  const memberships = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  const adminUserIds: Array<Id<"users">> = [];
  for (const membership of memberships) {
    if (membership.roleId === adminRole._id) {
      adminUserIds.push(membership.userId);
    }
  }
  return adminUserIds;
}

export async function countSuperAdmins(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  const superAdminUserIds = await listSuperAdminUserIds(ctx, organizationId);
  return superAdminUserIds.length;
}

export async function requireSuperAdmin(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const isSuperAdmin = await isUserSuperAdmin(ctx, organizationId, userId);
  if (!isSuperAdmin) {
    throw new ConvexError("Only a SuperAdmin can perform this action");
  }
}

export async function assertCanRemoveSuperAdminStatus(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  nextRoleId?: Id<"roles">,
) {
  const superAdminRole = await getSuperAdminRole(ctx, organizationId);
  if (!superAdminRole) {
    return;
  }

  const membership = await getMembership(ctx, organizationId, userId);
  if (!membership || membership.roleId !== superAdminRole._id) {
    return;
  }

  if (nextRoleId === superAdminRole._id) {
    return;
  }

  const superAdminCount = await countSuperAdmins(ctx, organizationId);
  if (superAdminCount <= 1) {
    throw new ConvexError(
      "Cannot remove the last SuperAdmin from the organization",
    );
  }
}

export async function assertCanRemoveSuperAdminMember(
  ctx: OrgCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  await assertCanRemoveSuperAdminStatus(ctx, organizationId, userId);
}

export function hasUnanimousSuperAdminApproval(
  superAdminUserIds: Array<Id<"users">>,
  approvedByUserIds: Array<Id<"users">>,
  requestedByUserId: Id<"users">,
): boolean {
  const requiredApprovers = superAdminUserIds.filter(
    (id) => id !== requestedByUserId,
  );
  if (requiredApprovers.length === 0) {
    return true;
  }
  const approvedSet = new Set(approvedByUserIds);
  return requiredApprovers.every((id) => approvedSet.has(id));
}

export async function promoteToSuperAdmin(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const superAdminRole = await getSuperAdminRole(ctx, organizationId);
  if (!superAdminRole) {
    return;
  }

  const membership = await getMembership(ctx, organizationId, userId);
  if (!membership) {
    throw new ConvexError("User is not a member of this organization");
  }

  if (membership.roleId !== superAdminRole._id) {
    await ctx.db.patch(membership._id, {
      roleId: superAdminRole._id,
    });
  }
}

export async function resolvePrimarySuperAdminUserId(
  ctx: OrgCtx,
  organization: Doc<"organizations">,
): Promise<Id<"users"> | null> {
  if (organization.ownerUserId) {
    const owner = await ctx.db.get(organization.ownerUserId);
    if (owner) {
      return organization.ownerUserId;
    }
  }

  const superAdminUserIds = await listSuperAdminUserIds(ctx, organization._id);
  return superAdminUserIds[0] ?? null;
}
