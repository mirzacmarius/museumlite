import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  addMs,
  ORGANIZATION_DELETION_FINAL_NOTICE_DISPLAY_MS,
  ORGANIZATION_DELETION_GRACE_MS,
  ORGANIZATION_DELETION_PURGE_AFTER_FINAL_NOTICE_MS,
  ORGANIZATION_DELETION_WAIT_BEFORE_FINAL_NOTICE_MS,
} from "./utils/organizationDeletionTimings";
import { requirePermission } from "./utils/permissions";

interface OrganizationDeletionAuditChanges {
  name?: string;
  status?: string;
  graceEndsAt?: number;
  scheduledPurgeAt?: number;
  newOwnerUserId?: string;
  previousOwnerUserId?: string;
  preservedSubscriptionTier?: string;
  cancelledVia?: string;
}

async function logOrganizationDeletionAction(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    action: string;
    entityId: string;
    changes?: OrganizationDeletionAuditChanges;
  },
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: args.organizationId,
    userId: args.userId,
    action: args.action,
    entityType: "organization",
    entityId: args.entityId,
    changes: args.changes,
  });
}

export const organizationDeletionStatusValidator = v.union(
  v.literal("grace_period"),
  v.literal("awaiting_final_notice"),
  v.literal("pending_purge"),
  v.literal("cancelled"),
  v.literal("completed"),
);

const deletionStatusResponseValidator = v.union(
  organizationDeletionStatusValidator,
  v.null(),
);

const deletionSummaryValidator = v.object({
  deletionId: v.id("organizationDeletions"),
  status: organizationDeletionStatusValidator,
  requestedAt: v.number(),
  graceEndsAt: v.number(),
  finalNoticeAt: v.number(),
  scheduledDeletionDate: v.union(v.number(), v.null()),
  scheduledPurgeAt: v.union(v.number(), v.null()),
  cancelToken: v.string(),
});

type DeletionCtx = QueryCtx | MutationCtx;
type SubscriptionTier = "free" | "pro" | "enterprise";

function generateCancelToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function shouldScheduleDeletionEmail(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

function getSubscriptionTier(
  organization: Doc<"organizations">,
): SubscriptionTier {
  return organization.subscriptionTier ?? "free";
}

async function resolveOrganizationOwnerUserId(
  ctx: DeletionCtx,
  organization: Doc<"organizations">,
): Promise<Id<"users"> | null> {
  if (organization.ownerUserId) {
    const owner = await ctx.db.get(organization.ownerUserId);
    if (owner) {
      return organization.ownerUserId;
    }
  }

  const memberships = await ctx.db
    .query("userOrganizations")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organization._id),
    )
    .collect();

  for (const membership of memberships) {
    const role = await ctx.db.get(membership.roleId);
    if (role?.isSystemRole && role.name === "admin") {
      return membership.userId;
    }
  }

  return memberships[0]?.userId ?? null;
}

async function requireOrganizationOwner(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  await requirePermission(ctx, organizationId, "organization.manage_settings");

  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  const ownerUserId = await resolveOrganizationOwnerUserId(ctx, organization);
  if (!ownerUserId || ownerUserId !== userId) {
    throw new ConvexError("Only the organization owner can perform this action");
  }

  return organization;
}

async function getActiveDeletionForOrganization(
  ctx: DeletionCtx,
  organizationId: Id<"organizations">,
) {
  const deletions = await ctx.db
    .query("organizationDeletions")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  return (
    deletions.find(
      (deletion) =>
        deletion.status === "grace_period" ||
        deletion.status === "awaiting_final_notice" ||
        deletion.status === "pending_purge",
    ) ?? null
  );
}

async function getOwnerEmail(
  ctx: DeletionCtx,
  organization: Doc<"organizations">,
): Promise<string | null> {
  const ownerUserId = await resolveOrganizationOwnerUserId(ctx, organization);
  if (!ownerUserId) {
    return null;
  }
  const owner = await ctx.db.get(ownerUserId);
  return owner?.email ?? null;
}

async function reactivateOrganization(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  await ctx.db.patch(organizationId, {
    isActive: true,
  });
}

async function cancelDeletionRecord(
  ctx: MutationCtx,
  deletion: Doc<"organizationDeletions">,
) {
  await ctx.db.patch(deletion._id, {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
  await reactivateOrganization(ctx, deletion.organizationId);
}

function buildDeletionSummary(deletion: Doc<"organizationDeletions">) {
  return {
    deletionId: deletion._id,
    status: deletion.status,
    requestedAt: deletion.requestedAt,
    graceEndsAt: deletion.graceEndsAt,
    finalNoticeAt: deletion.finalNoticeAt,
    scheduledDeletionDate: deletion.scheduledDeletionDate ?? null,
    scheduledPurgeAt: deletion.scheduledPurgeAt ?? null,
    cancelToken: deletion.cancelToken,
  };
}

async function scheduleGracePeriodEmail(
  ctx: MutationCtx,
  args: {
    email: string;
    organizationName: string;
    cancelToken: string;
    graceEndsAt: number;
  },
) {
  if (!shouldScheduleDeletionEmail()) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.email.actions.sendOrganizationDeletionGraceEmailAction,
    {
      email: args.email,
      organizationName: args.organizationName,
      token: args.cancelToken,
      graceEndsAt: args.graceEndsAt,
    },
  );
}

async function scheduleFinalNoticeEmail(
  ctx: MutationCtx,
  args: {
    email: string;
    organizationName: string;
    cancelToken: string;
    scheduledDeletionDate: number;
    scheduledPurgeAt: number;
  },
) {
  if (!shouldScheduleDeletionEmail()) {
    return;
  }

  await ctx.scheduler.runAfter(
    0,
    internal.email.actions.sendOrganizationDeletionFinalNoticeEmailAction,
    {
      email: args.email,
      organizationName: args.organizationName,
      token: args.cancelToken,
      scheduledDeletionDate: args.scheduledDeletionDate,
      scheduledPurgeAt: args.scheduledPurgeAt,
    },
  );
}

export const getDeletionStatus = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(deletionSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );

    const deletion = await getActiveDeletionForOrganization(
      ctx,
      args.organizationId,
    );
    if (!deletion) {
      return null;
    }

    return buildDeletionSummary(deletion);
  },
});

export const getDeletionByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      organizationName: v.string(),
      status: organizationDeletionStatusValidator,
      scheduledDeletionDate: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const deletion = await ctx.db
      .query("organizationDeletions")
      .withIndex("by_cancel_token", (q) => q.eq("cancelToken", args.token))
      .first();

    if (!deletion) {
      return null;
    }

    const organization = await ctx.db.get(deletion.organizationId);
    if (!organization) {
      return null;
    }

    return {
      organizationName: organization.name,
      status: deletion.status,
      scheduledDeletionDate: deletion.scheduledDeletionDate ?? null,
    };
  },
});

export const requestDeletion = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: deletionSummaryValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const organization = await requireOrganizationOwner(
      ctx,
      args.organizationId,
      userId,
    );

    if (organization.parentOrganizationId) {
      throw new ConvexError(
        "Sub-organizations cannot be deleted from this screen",
      );
    }

    const existingDeletion = await getActiveDeletionForOrganization(
      ctx,
      args.organizationId,
    );
    if (existingDeletion) {
      return buildDeletionSummary(existingDeletion);
    }

    const now = Date.now();
    const preservedTier = getSubscriptionTier(organization);
    const graceEndsAt = addMs(now, ORGANIZATION_DELETION_GRACE_MS);
    const finalNoticeAt = addMs(
      graceEndsAt,
      ORGANIZATION_DELETION_WAIT_BEFORE_FINAL_NOTICE_MS,
    );
    const cancelToken = generateCancelToken();

    const deletionId = await ctx.db.insert("organizationDeletions", {
      organizationId: args.organizationId,
      status: "grace_period",
      requestedAt: now,
      requestedByUserId: userId,
      cancelToken,
      graceEndsAt,
      finalNoticeAt,
      preservedSubscriptionTier: preservedTier,
      initialEmailSentAt: now,
    });

    await ctx.db.patch(args.organizationId, {
      isActive: false,
      ownerUserId: organization.ownerUserId ?? userId,
    });

    const ownerEmail = await getOwnerEmail(ctx, organization);
    if (ownerEmail) {
      await scheduleGracePeriodEmail(ctx, {
        email: ownerEmail,
        organizationName: organization.name,
        cancelToken,
        graceEndsAt,
      });
    }

    const deletion = await ctx.db.get(deletionId);
    if (!deletion) {
      throw new ConvexError("Failed to create deletion request");
    }

    await logOrganizationDeletionAction(ctx, {
      organizationId: args.organizationId,
      userId,
      action: "scheduled_organization_deletion",
      entityId: deletion._id,
      changes: {
        name: organization.name,
        status: deletion.status,
        graceEndsAt: deletion.graceEndsAt,
      },
    });

    return buildDeletionSummary(deletion);
  },
});

export const cancelDeletion = mutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    token: v.optional(v.string()),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    status: deletionStatusResponseValidator,
  }),
  handler: async (ctx, args) => {
    if (!args.organizationId && !args.token) {
      throw new ConvexError("Organization or token is required");
    }

    let deletion: Doc<"organizationDeletions"> | null = null;

    const cancelToken = args.token;
    if (cancelToken) {
      deletion = await ctx.db
        .query("organizationDeletions")
        .withIndex("by_cancel_token", (q) => q.eq("cancelToken", cancelToken))
        .first();
    } else if (args.organizationId) {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new ConvexError("Not authenticated");
      }
      await requireOrganizationOwner(ctx, args.organizationId, userId);
      deletion = await getActiveDeletionForOrganization(
        ctx,
        args.organizationId,
      );
    }

    if (!deletion) {
      throw new ConvexError("No active deletion process found");
    }

    if (
      deletion.status !== "grace_period" &&
      deletion.status !== "awaiting_final_notice" &&
      deletion.status !== "pending_purge"
    ) {
      throw new ConvexError("Deletion process is no longer active");
    }

    await cancelDeletionRecord(ctx, deletion);

    const organization = await ctx.db.get(deletion.organizationId);
    const actorUserId =
      (await getAuthUserId(ctx)) ?? deletion.requestedByUserId;

    await logOrganizationDeletionAction(ctx, {
      organizationId: deletion.organizationId,
      userId: actorUserId,
      action: "cancelled_organization_deletion",
      entityId: deletion._id,
      changes: {
        name: organization?.name,
        status: "cancelled",
        cancelledVia: args.token ? "email_link" : "settings",
      },
    });

    return {
      organizationId: deletion.organizationId,
      status: "cancelled" as const,
    };
  },
});

export const transferOwnership = mutation({
  args: {
    organizationId: v.id("organizations"),
    newOwnerUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    if (args.newOwnerUserId === userId) {
      throw new ConvexError("You are already the organization owner");
    }

    const organization = await requireOrganizationOwner(
      ctx,
      args.organizationId,
      userId,
    );

    const membership = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.newOwnerUserId).eq("organizationId", args.organizationId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("New owner must be a member of the organization");
    }

    const preservedTier = getSubscriptionTier(organization);
    const activeDeletion = await getActiveDeletionForOrganization(
      ctx,
      args.organizationId,
    );
    if (activeDeletion) {
      await cancelDeletionRecord(ctx, activeDeletion);
    }

    await ctx.db.patch(args.organizationId, {
      ownerUserId: args.newOwnerUserId,
      requiresPlanSelection: true,
      preservedSubscriptionTier: preservedTier,
      subscriptionTier: preservedTier,
      isActive: true,
    });

    await logOrganizationDeletionAction(ctx, {
      organizationId: args.organizationId,
      userId,
      action: "transferred_organization_ownership",
      entityId: args.organizationId,
      changes: {
        name: organization.name,
        previousOwnerUserId: userId,
        newOwnerUserId: args.newOwnerUserId,
        preservedSubscriptionTier: preservedTier,
        status: activeDeletion ? "deletion_cancelled" : undefined,
      },
    });

    return null;
  },
});

export const acknowledgeTransferredPlan = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (organization.ownerUserId !== userId) {
      throw new ConvexError("Only the organization owner can confirm the plan");
    }

    await ctx.db.patch(args.organizationId, {
      requiresPlanSelection: false,
      preservedSubscriptionTier: undefined,
    });

    await logOrganizationDeletionAction(ctx, {
      organizationId: args.organizationId,
      userId,
      action: "confirmed_organization_plan",
      entityId: args.organizationId,
      changes: {
        name: organization.name,
        preservedSubscriptionTier: organization.subscriptionTier,
      },
    });

    return null;
  },
});

export const listTransferCandidates = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      roleName: v.string(),
    }),
  ),
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

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const candidates = await Promise.all(
      memberships.map(async (membership) => {
        if (membership.userId === userId) {
          return null;
        }
        const [user, role] = await Promise.all([
          ctx.db.get(membership.userId),
          ctx.db.get(membership.roleId),
        ]);
        if (!user || !role) {
          return null;
        }
        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          roleName: role.name,
        };
      }),
    );

    return candidates.filter(
      (candidate): candidate is NonNullable<typeof candidate> =>
        candidate !== null,
    );
  },
});

export const processOrganizationDeletionsInternal = internalMutation({
  args: {},
  returns: v.object({
    advanced: v.number(),
    purged: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    let advanced = 0;
    let purged = 0;

    const graceExpired = await ctx.db
      .query("organizationDeletions")
      .withIndex("by_status_and_graceEndsAt", (q) =>
        q.eq("status", "grace_period").lte("graceEndsAt", now),
      )
      .collect();

    for (const deletion of graceExpired) {
      await ctx.db.patch(deletion._id, {
        status: "awaiting_final_notice",
      });
      advanced += 1;
    }

    const readyForFinalNotice = await ctx.db
      .query("organizationDeletions")
      .withIndex("by_status_and_finalNoticeAt", (q) =>
        q.eq("status", "awaiting_final_notice").lte("finalNoticeAt", now),
      )
      .collect();

    for (const deletion of readyForFinalNotice) {
      const scheduledDeletionDate = addMs(
        now,
        ORGANIZATION_DELETION_FINAL_NOTICE_DISPLAY_MS,
      );
      const scheduledPurgeAt = addMs(
        now,
        ORGANIZATION_DELETION_PURGE_AFTER_FINAL_NOTICE_MS,
      );

      await ctx.db.patch(deletion._id, {
        status: "pending_purge",
        scheduledDeletionDate,
        scheduledPurgeAt,
        finalNoticeEmailSentAt: now,
      });

      const organization = await ctx.db.get(deletion.organizationId);
      if (organization) {
        const ownerEmail = await getOwnerEmail(ctx, organization);
        if (ownerEmail) {
          await scheduleFinalNoticeEmail(ctx, {
            email: ownerEmail,
            organizationName: organization.name,
            cancelToken: deletion.cancelToken,
            scheduledDeletionDate,
            scheduledPurgeAt,
          });
        }

        await logOrganizationDeletionAction(ctx, {
          organizationId: deletion.organizationId,
          userId: deletion.requestedByUserId,
          action: "sent_organization_deletion_final_notice",
          entityId: deletion._id,
          changes: {
            name: organization.name,
            status: "pending_purge",
            scheduledPurgeAt,
          },
        });
      }

      advanced += 1;
    }

    const readyForPurge = await ctx.db
      .query("organizationDeletions")
      .withIndex("by_status_and_scheduledPurgeAt", (q) =>
        q.eq("status", "pending_purge").lte("scheduledPurgeAt", now),
      )
      .collect();

    for (const deletion of readyForPurge) {
      if (!deletion.scheduledPurgeAt || deletion.scheduledPurgeAt > now) {
        continue;
      }

      const organizationBeforePurge = await ctx.db.get(deletion.organizationId);
      if (organizationBeforePurge) {
        await logOrganizationDeletionAction(ctx, {
          organizationId: deletion.organizationId,
          userId: deletion.requestedByUserId,
          action: "completed_organization_deletion",
          entityId: deletion._id,
          changes: {
            name: organizationBeforePurge.name,
            scheduledPurgeAt: deletion.scheduledPurgeAt,
          },
        });
      }

      await ctx.runMutation(
        internal.organizationCleanup.purgeOrganizationsInternal,
        {
          organizationIds: [deletion.organizationId],
          dryRun: false,
        },
      );

      const deletionAfterPurge = await ctx.db.get(deletion._id);
      if (deletionAfterPurge) {
        await ctx.db.patch(deletion._id, {
          status: "completed",
          completedAt: now,
        });
      }
      purged += 1;
    }

    return { advanced, purged };
  },
});
