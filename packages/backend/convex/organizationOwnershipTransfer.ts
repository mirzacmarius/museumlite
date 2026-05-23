import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";
import {
  hasUnanimousSuperAdminApproval,
  isUserSuperAdmin,
  listSuperAdminUserIds,
  promoteToSuperAdmin,
  requireSuperAdmin,
} from "./utils/superAdmins";

const ownershipTransferStatusValidator = v.union(
  v.literal("pending_super_admin_approval"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
  v.literal("completed"),
);

const ownershipTransferSummaryValidator = v.object({
  requestId: v.id("organizationOwnershipTransferRequests"),
  organizationId: v.id("organizations"),
  targetOrganizationId: v.id("organizations"),
  status: ownershipTransferStatusValidator,
  requestedAt: v.number(),
  newOwnerUserId: v.id("users"),
  superAdminApprovedByUserIds: v.array(v.id("users")),
});

async function requireOrganizationSuperAdmin(
  ctx: Parameters<typeof requireSuperAdmin>[0],
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  await requirePermission(ctx, organizationId, "organization.manage_settings");

  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  await requireSuperAdmin(ctx, organizationId, userId);

  return organization;
}

function buildOwnershipTransferSummary(
  request: Doc<"organizationOwnershipTransferRequests">,
) {
  return {
    requestId: request._id,
    organizationId: request.organizationId,
    targetOrganizationId: request.targetOrganizationId,
    status: request.status,
    requestedAt: request.requestedAt,
    newOwnerUserId: request.newOwnerUserId,
    superAdminApprovedByUserIds: request.superAdminApprovedByUserIds ?? [],
  };
}

async function getPendingOwnershipTransfer(
  ctx: Parameters<typeof requireSuperAdmin>[0],
  organizationId: Id<"organizations">,
) {
  return await ctx.db
    .query("organizationOwnershipTransferRequests")
    .withIndex("by_organization_and_status", (q) =>
      q
        .eq("organizationId", organizationId)
        .eq("status", "pending_super_admin_approval"),
    )
    .first();
}

async function completeOwnershipTransfer(
  ctx: Parameters<typeof requireSuperAdmin>[0],
  request: Doc<"organizationOwnershipTransferRequests">,
) {
  const organization = await ctx.db.get(request.organizationId);
  const targetOrganization = await ctx.db.get(request.targetOrganizationId);
  if (!organization || !targetOrganization) {
    throw new ConvexError("Organization not found");
  }

  const targetMembership = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q
        .eq("userId", request.newOwnerUserId)
        .eq("organizationId", request.targetOrganizationId),
    )
    .first();

  if (!targetMembership) {
    throw new ConvexError(
      "New owner must be a member of the target organization",
    );
  }

  await promoteToSuperAdmin(
    ctx,
    request.organizationId,
    request.newOwnerUserId,
  );

  await ctx.db.patch(request.organizationId, {
    ownerUserId: request.newOwnerUserId,
    parentOrganizationId: request.targetOrganizationId,
    rootOrganizationId:
      targetOrganization.rootOrganizationId ?? targetOrganization._id,
  });

  await ctx.db.patch(request._id, {
    status: "completed",
    resolvedAt: Date.now(),
  });
}

export const listPendingOwnershipTransfers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(ownershipTransferSummaryValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const requests = await ctx.db
      .query("organizationOwnershipTransferRequests")
      .withIndex("by_organization_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("status", "pending_super_admin_approval"),
      )
      .collect();

    return requests.map(buildOwnershipTransferSummary);
  },
});

export const requestOwnershipTransfer = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetOrganizationId: v.id("organizations"),
    newOwnerUserId: v.id("users"),
  },
  returns: ownershipTransferSummaryValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    if (args.organizationId === args.targetOrganizationId) {
      throw new ConvexError("Cannot transfer ownership to the same organization");
    }

    await requireOrganizationSuperAdmin(ctx, args.organizationId, userId);

    const targetOrganization = await ctx.db.get(args.targetOrganizationId);
    if (!targetOrganization) {
      throw new ConvexError("Target organization not found");
    }

    if (targetOrganization.allowsIncomingTransferRequests !== true) {
      throw new ConvexError(
        "Target organization does not accept ownership transfers",
      );
    }

    const isNewOwnerSuperAdmin = await isUserSuperAdmin(
      ctx,
      args.organizationId,
      args.newOwnerUserId,
    );
    if (!isNewOwnerSuperAdmin) {
      throw new ConvexError(
        "Ownership can only be transferred to another SuperAdmin",
      );
    }

    const existingRequest = await getPendingOwnershipTransfer(
      ctx,
      args.organizationId,
    );
    if (existingRequest) {
      return buildOwnershipTransferSummary(existingRequest);
    }

    const requestId = await ctx.db.insert(
      "organizationOwnershipTransferRequests",
      {
        organizationId: args.organizationId,
        targetOrganizationId: args.targetOrganizationId,
        status: "pending_super_admin_approval",
        requestedByUserId: userId,
        requestedAt: Date.now(),
        newOwnerUserId: args.newOwnerUserId,
        superAdminApprovedByUserIds: [],
      },
    );

    const request = await ctx.db.get(requestId);
    if (!request) {
      throw new ConvexError("Failed to create ownership transfer request");
    }

    return buildOwnershipTransferSummary(request);
  },
});

export const approveOwnershipTransfer = mutation({
  args: {
    requestId: v.id("organizationOwnershipTransferRequests"),
  },
  returns: ownershipTransferSummaryValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError("Ownership transfer request not found");
    }

    if (request.status !== "pending_super_admin_approval") {
      throw new ConvexError("Ownership transfer request is no longer pending");
    }

    await requireOrganizationSuperAdmin(ctx, request.organizationId, userId);

    const approvedByUserIds = request.superAdminApprovedByUserIds ?? [];
    if (!approvedByUserIds.includes(userId)) {
      approvedByUserIds.push(userId);
    }

    const superAdminUserIds = await listSuperAdminUserIds(
      ctx,
      request.organizationId,
    );
    const hasApproval = hasUnanimousSuperAdminApproval(
      superAdminUserIds,
      approvedByUserIds,
      request.requestedByUserId,
    );

    if (!hasApproval) {
      await ctx.db.patch(request._id, {
        superAdminApprovedByUserIds: approvedByUserIds,
      });
      const updatedRequest = await ctx.db.get(request._id);
      if (!updatedRequest) {
        throw new ConvexError("Ownership transfer request not found");
      }
      return buildOwnershipTransferSummary(updatedRequest);
    }

    await completeOwnershipTransfer(ctx, request);

    const completedRequest = await ctx.db.get(request._id);
    if (!completedRequest) {
      throw new ConvexError("Ownership transfer request not found");
    }

    return buildOwnershipTransferSummary(completedRequest);
  },
});

export const cancelOwnershipTransfer = mutation({
  args: {
    requestId: v.id("organizationOwnershipTransferRequests"),
  },
  returns: ownershipTransferSummaryValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError("Ownership transfer request not found");
    }

    if (request.status !== "pending_super_admin_approval") {
      throw new ConvexError("Ownership transfer request is no longer pending");
    }

    await requireOrganizationSuperAdmin(ctx, request.organizationId, userId);

    await ctx.db.patch(request._id, {
      status: "cancelled",
      resolvedAt: Date.now(),
    });

    const cancelledRequest = await ctx.db.get(request._id);
    if (!cancelledRequest) {
      throw new ConvexError("Ownership transfer request not found");
    }

    return buildOwnershipTransferSummary(cancelledRequest);
  },
});
