import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import {
  getCurrentYear,
  getNextYearBasedValue,
  padNumber,
} from "./utils/numberGenerator";
import {
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
  requirePermission,
} from "./utils/permissions";

const targetCollectionStatusValidator = v.union(
  v.literal("deaccessioned"),
  v.literal("archived"),
  v.literal("deleted"),
);

function resolveTargetCollectionStatus(deaccession: {
  targetCollectionStatus?: "deaccessioned" | "archived" | "deleted";
}) {
  return deaccession.targetCollectionStatus ?? "deaccessioned";
}

async function applyApprovedCollectionStatus(
  ctx: MutationCtx,
  deaccession: Doc<"deaccessions">,
  userId: Id<"users">,
) {
  const approvedAt = Date.now();
  const targetCollectionStatus = resolveTargetCollectionStatus(deaccession);

  if (targetCollectionStatus === "archived") {
    await ctx.db.patch(deaccession.collectionId, {
      status: "archived",
      archivedAt: approvedAt,
      archivedBy: userId,
      archivedReason: deaccession.reason,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined,
      lastModifiedBy: userId,
      lastModifiedAt: approvedAt,
    });
    return;
  }

  if (targetCollectionStatus === "deleted") {
    await ctx.db.patch(deaccession.collectionId, {
      status: "deleted",
      deletedAt: approvedAt,
      deletedBy: userId,
      deletedReason: deaccession.reason,
      archivedAt: undefined,
      archivedBy: undefined,
      archivedReason: undefined,
      lastModifiedBy: userId,
      lastModifiedAt: approvedAt,
    });
    return;
  }

  await ctx.db.patch(deaccession.collectionId, {
    status: "deaccessioned",
    lastModifiedBy: userId,
    lastModifiedAt: approvedAt,
  });
}

/**
 * Generate deaccession number
 * Format: DA-{ORG}-{YEAR}-{SEQUENCE} e.g. DA-MUS-2025-001
 */
async function generateDeaccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const year = getCurrentYear();
  const orgSlug = org.slug.toUpperCase().substring(0, 3);

  const counter = await ctx.db
    .query("deaccessionCounters")
    .withIndex("by_organization_and_year", (q) =>
      q.eq("organizationId", organizationId).eq("year", year),
    )
    .first();

  const nextValue = await getNextYearBasedValue(ctx, counter, {
    tableName: "deaccessionCounters",
    organizationId,
    year,
  });

  return `DA-${orgSlug}-${year}-${padNumber(nextValue, 3)}`;
}

async function canInitiateDeaccessionWorkflowForUser(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
) {
  const userOrganization = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user_and_organization", (q) =>
      q.eq("userId", userId).eq("organizationId", organizationId),
    )
    .first();

  if (!userOrganization) {
    return false;
  }

  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization_and_workflowType", (q) =>
      q.eq("organizationId", organizationId).eq("workflowType", "deaccession"),
    )
    .first();

  if (workflowConfig) {
    return workflowConfig.canInitiateRoles.includes(userOrganization.roleId);
  }

  const rolePermissions = await ctx.db
    .query("rolePermissions")
    .withIndex("by_role", (q) => q.eq("roleId", userOrganization.roleId))
    .collect();

  const permissions = await Promise.all(
    rolePermissions.map((rolePermission) =>
      ctx.db.get(rolePermission.permissionId),
    ),
  );

  return permissions.some(
    (permission) => permission?.name === "collections.create",
  );
}

async function createDeaccessionRecord(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    collectionId: Id<"collections">;
    deaccessionNumber?: string;
    dateDeaccessioned: number;
    reason: string;
    method: "sale" | "donation" | "destruction" | "transfer";
    targetCollectionStatus?: "deaccessioned" | "archived" | "deleted";
    disposition?: string;
    notes?: string;
    proceedsAmount?: number;
    proceedsCurrency?: string;
    proceedsRecipient?: string;
    proceedsDate?: number;
    proceedsNotes?: string;
  },
  userId: Id<"users">,
) {
  const collection = await ctx.db.get(args.collectionId);
  if (!collection) {
    throw new Error("Collection not found");
  }

  if (collection.organizationId !== args.organizationId) {
    throw new Error("Collection does not belong to organization");
  }

  if (collection.status === "loaned") {
    throw new Error("Cannot remove an object that is currently on loan");
  }

  const canInitiate = await canInitiateDeaccessionWorkflowForUser(
    ctx,
    args.organizationId,
    userId,
  );

  if (!canInitiate) {
    throw new Error("Permission denied: cannot initiate deaccession workflow");
  }

  const deaccessionNumber = args.deaccessionNumber
    ? args.deaccessionNumber
    : await generateDeaccessionNumber(ctx, args.organizationId);

  const workflowConfig = await ctx.db
    .query("workflowConfigs")
    .withIndex("by_organization_and_workflowType", (q) =>
      q
        .eq("organizationId", args.organizationId)
        .eq("workflowType", "deaccession"),
    )
    .first();

  const workflowHistory = workflowConfig
    ? [
        {
          step: 0,
          approvedBy: userId,
          approvedAt: Date.now(),
          comment: "Created",
        },
      ]
    : [];

  const deaccessionId = await ctx.db.insert("deaccessions", {
    organizationId: args.organizationId,
    collectionId: args.collectionId,
    deaccessionNumber,
    dateDeaccessioned: args.dateDeaccessioned,
    reason: args.reason,
    method: args.method,
    disposition: args.disposition,
    notes: args.notes,
    status: workflowConfig ? "pending" : "approved",
    targetCollectionStatus: args.targetCollectionStatus ?? "deaccessioned",
    workflowStep: workflowConfig ? 1 : undefined,
    workflowHistory,
    proceedsAmount: args.proceedsAmount,
    proceedsCurrency: args.proceedsCurrency,
    proceedsRecipient: args.proceedsRecipient,
    proceedsDate: args.proceedsDate,
    proceedsNotes: args.proceedsNotes,
  });

  await ctx.runMutation(internal.audit.logAction, {
    organizationId: args.organizationId,
    userId,
    action: "created",
    entityType: "deaccession",
    entityId: deaccessionId,
    changes: {
      deaccessionNumber,
      status: workflowConfig ? "pending" : "approved",
    },
  });

  if (workflowConfig) {
    const usersToNotify = await getUsersToNotifyForWorkflowStep(
      ctx,
      args.organizationId,
      "deaccession",
      1,
    );

    for (const approverId of usersToNotify) {
      if (approverId !== userId) {
        await ctx.runMutation(internal.audit.createNotificationInternal, {
          organizationId: args.organizationId,
          userId: approverId,
          type: "workflow_pending",
          title: "New Deaccession Requires Approval",
          message: `Deaccession ${deaccessionNumber} is pending your approval at step 1.`,
          relatedEntityType: "deaccession",
          relatedEntityId: deaccessionId,
        });
      }
    }
  }

  if (!workflowConfig) {
    const createdDeaccession = await ctx.db.get(deaccessionId);
    if (createdDeaccession) {
      await applyApprovedCollectionStatus(ctx, createdDeaccession, userId);
    }
  }

  return deaccessionId;
}

/**
 * Create deaccession record
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    deaccessionNumber: v.optional(v.string()),
    dateDeaccessioned: v.number(),
    reason: v.string(),
    method: v.union(
      v.literal("sale"),
      v.literal("donation"),
      v.literal("destruction"),
      v.literal("transfer"),
    ),
    targetCollectionStatus: v.optional(targetCollectionStatusValidator),
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
  },
  returns: v.id("deaccessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await createDeaccessionRecord(ctx, args, userId);
  },
});

export const createInternal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    createdByUserId: v.id("users"),
    deaccessionNumber: v.optional(v.string()),
    dateDeaccessioned: v.number(),
    reason: v.string(),
    method: v.union(
      v.literal("sale"),
      v.literal("donation"),
      v.literal("destruction"),
      v.literal("transfer"),
    ),
    targetCollectionStatus: v.optional(targetCollectionStatusValidator),
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
  },
  returns: v.id("deaccessions"),
  handler: async (ctx, args) => {
    return await createDeaccessionRecord(
      ctx,
      {
        organizationId: args.organizationId,
        collectionId: args.collectionId,
        deaccessionNumber: args.deaccessionNumber,
        dateDeaccessioned: args.dateDeaccessioned,
        reason: args.reason,
        method: args.method,
        targetCollectionStatus: args.targetCollectionStatus,
        disposition: args.disposition,
        notes: args.notes,
        proceedsAmount: args.proceedsAmount,
        proceedsCurrency: args.proceedsCurrency,
        proceedsRecipient: args.proceedsRecipient,
        proceedsDate: args.proceedsDate,
        proceedsNotes: args.proceedsNotes,
      },
      args.createdByUserId,
    );
  },
});

/**
 * List deaccessions
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
    search: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("deaccessions"),
        deaccessionNumber: v.string(),
        collectionId: v.id("collections"),
        collectionTitle: v.string(),
        accessionNumber: v.optional(v.string()),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.union(
          v.literal("sale"),
          v.literal("donation"),
          v.literal("destruction"),
          v.literal("transfer"),
        ),
        targetCollectionStatus: targetCollectionStatusValidator,
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
        workflowStep: v.optional(v.number()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    let allResults: Doc<"deaccessions">[];

    if (args.status) {
      allResults = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", args.status),
        )
        .collect();
    } else {
      allResults = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect();
    }

    const deaccessionsWithCollectionInfo = await Promise.all(
      allResults.map(async (deaccession) => {
        const collection = await ctx.db.get(deaccession.collectionId);
        return {
          ...deaccession,
          collectionTitle: collection?.title || "",
          accessionNumber: collection?.accessionNumber,
        };
      }),
    );

    // Apply search filter if provided
    const searchLower = args.search?.trim().toLowerCase();
    const filteredResults = searchLower
      ? deaccessionsWithCollectionInfo.filter((deaccession) => {
          return (
            deaccession.deaccessionNumber.toLowerCase().includes(searchLower) ||
            deaccession.reason.toLowerCase().includes(searchLower) ||
            deaccession.disposition?.toLowerCase().includes(searchLower) ||
            deaccession.notes?.toLowerCase().includes(searchLower) ||
            deaccession.collectionTitle.toLowerCase().includes(searchLower) ||
            deaccession.accessionNumber?.toLowerCase().includes(searchLower) ||
            deaccession.method.toLowerCase().includes(searchLower) ||
            false
          );
        })
      : deaccessionsWithCollectionInfo;

    // Sort by date deaccessioned (newest first)
    filteredResults.sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? Number.parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      filteredResults.length,
    );
    const page = filteredResults.slice(startIndex, endIndex);

    return {
      page: page.map((item) => ({
        _id: item._id,
        deaccessionNumber: item.deaccessionNumber,
        collectionId: item.collectionId,
        collectionTitle: item.collectionTitle || "Unknown object",
        accessionNumber: item.accessionNumber,
        dateDeaccessioned: item.dateDeaccessioned,
        reason: item.reason,
        method: item.method,
        targetCollectionStatus: resolveTargetCollectionStatus(item),
        status: item.status,
        workflowStep: item.workflowStep,
      })),
      isDone: endIndex >= filteredResults.length,
      continueCursor: endIndex.toString(),
    };
  },
});

export const getWorkflowSteps = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    hasWorkflow: v.boolean(),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        name: v.string(),
        roleName: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization_and_workflowType", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("workflowType", "deaccession"),
      )
      .first();

    if (!workflowConfig) {
      return {
        hasWorkflow: false,
        steps: [
          { stepNumber: 1, name: "Pending Review" },
          { stepNumber: -1, name: "Approved" },
          { stepNumber: -2, name: "Rejected" },
        ],
      };
    }

    const stepsWithRoles = await Promise.all(
      workflowConfig.steps.map(async (step) => {
        const role = await ctx.db.get(step.roleId);
        return {
          stepNumber: step.stepNumber,
          name: step.name,
          roleName: role?.name,
        };
      }),
    );

    const normalizedSteps = [
      ...stepsWithRoles,
      { stepNumber: -1, name: "Approved" },
      { stepNumber: -2, name: "Rejected" },
    ].filter(
      (step, index, steps) =>
        steps.findIndex(
          (candidate) => candidate.stepNumber === step.stepNumber,
        ) === index,
    );

    return {
      hasWorkflow: true,
      steps: normalizedSteps,
    };
  },
});

/**
 * Get deaccession details
 */
export const get = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("deaccessions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      collectionId: v.id("collections"),
      deaccessionNumber: v.string(),
      dateDeaccessioned: v.number(),
      reason: v.string(),
      method: v.union(
        v.literal("sale"),
        v.literal("donation"),
        v.literal("destruction"),
        v.literal("transfer"),
      ),
      targetCollectionStatus: targetCollectionStatusValidator,
      disposition: v.optional(v.string()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      notes: v.optional(v.string()),
      workflowStep: v.optional(v.number()),
      workflowHistory: v.optional(
        v.array(
          v.object({
            step: v.number(),
            approvedBy: v.id("users"),
            approvedAt: v.number(),
            comment: v.optional(v.string()),
          }),
        ),
      ),
      proceedsAmount: v.optional(v.number()),
      proceedsCurrency: v.optional(v.string()),
      proceedsRecipient: v.optional(v.string()),
      proceedsDate: v.optional(v.number()),
      proceedsNotes: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      return null;
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    return {
      _id: deaccession._id,
      _creationTime: deaccession._creationTime,
      organizationId: deaccession.organizationId,
      collectionId: deaccession.collectionId,
      deaccessionNumber: deaccession.deaccessionNumber,
      dateDeaccessioned: deaccession.dateDeaccessioned,
      reason: deaccession.reason,
      method: deaccession.method,
      targetCollectionStatus: resolveTargetCollectionStatus(deaccession),
      disposition: deaccession.disposition,
      approvedBy: deaccession.approvedBy,
      approvedAt: deaccession.approvedAt,
      status: deaccession.status,
      notes: deaccession.notes,
      workflowStep: deaccession.workflowStep,
      workflowHistory: deaccession.workflowHistory ?? [],
      proceedsAmount: deaccession.proceedsAmount,
      proceedsCurrency: deaccession.proceedsCurrency,
      proceedsRecipient: deaccession.proceedsRecipient,
      proceedsDate: deaccession.proceedsDate,
      proceedsNotes: deaccession.proceedsNotes,
    };
  },
});

/**
 * Update deaccession (before approval)
 */
export const update = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    reason: v.optional(v.string()),
    method: v.optional(
      v.union(
        v.literal("sale"),
        v.literal("donation"),
        v.literal("destruction"),
        v.literal("transfer"),
      ),
    ),
    targetCollectionStatus: v.optional(targetCollectionStatusValidator),
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // Can only update if pending
    if (deaccession.status !== "pending") {
      throw new Error("Can only update pending deaccessions");
    }

    // Check permission
    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    const updates: {
      reason?: string;
      method?: "sale" | "donation" | "destruction" | "transfer";
      targetCollectionStatus?: "deaccessioned" | "archived" | "deleted";
      disposition?: string;
      notes?: string;
      proceedsAmount?: number;
      proceedsCurrency?: string;
      proceedsRecipient?: string;
      proceedsDate?: number;
      proceedsNotes?: string;
    } = {};

    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.method !== undefined) updates.method = args.method;
    if (args.targetCollectionStatus !== undefined) {
      updates.targetCollectionStatus = args.targetCollectionStatus;
    }
    if (args.disposition !== undefined) updates.disposition = args.disposition;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.proceedsAmount !== undefined)
      updates.proceedsAmount = args.proceedsAmount;
    if (args.proceedsCurrency !== undefined)
      updates.proceedsCurrency = args.proceedsCurrency;
    if (args.proceedsRecipient !== undefined)
      updates.proceedsRecipient = args.proceedsRecipient;
    if (args.proceedsDate !== undefined)
      updates.proceedsDate = args.proceedsDate;
    if (args.proceedsNotes !== undefined)
      updates.proceedsNotes = args.proceedsNotes;

    await ctx.db.patch(args.deaccessionId, updates);

    return null;
  },
});

/**
 * Submit for approval
 */
export const submitForApproval = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    if (deaccession.status !== "pending") {
      throw new Error("Deaccession is not pending");
    }

    // Reset workflow step if needed
    await ctx.db.patch(args.deaccessionId, {
      workflowStep: 1,
    });

    return null;
  },
});

/**
 * Approve deaccession
 */
export const approve = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.approve_deaccession",
    );

    if (deaccession.status !== "pending") {
      throw new Error("Deaccession is not pending");
    }

    // Get workflow config
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", deaccession.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "deaccession"))
      .first();

    if (workflowConfig) {
      // Multi-step workflow
      const currentStep = deaccession.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        deaccession.organizationId,
        "deaccession",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      // Add to workflow history
      const history = deaccession.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });

      // Check if this is the last step
      const isLastStep = currentStep >= workflowConfig.steps.length;

      if (isLastStep) {
        // Approve and mark collection as deaccessioned
        await ctx.db.patch(args.deaccessionId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        });

        // Log audit action
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: deaccession.organizationId,
          userId,
          action: "approved",
          entityType: "deaccession",
          entityId: args.deaccessionId,
          changes: { status: "approved", step: currentStep },
        });

        // Notify users who were involved in the workflow (from history)
        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: deaccession.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Deaccession Approved",
            message: `Deaccession ${deaccession.deaccessionNumber} has been fully approved.`,
            relatedEntityType: "deaccession",
            relatedEntityId: args.deaccessionId,
          });
        }

        await applyApprovedCollectionStatus(ctx, deaccession, userId);
      } else {
        // Move to next step
        await ctx.db.patch(args.deaccessionId, {
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        // Log audit action
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: deaccession.organizationId,
          userId,
          action: "step_approved",
          entityType: "deaccession",
          entityId: args.deaccessionId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        // Notify users who can approve the next step
        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          deaccession.organizationId,
          "deaccession",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: deaccession.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Deaccession Requires Your Approval",
              message: `Deaccession ${deaccession.deaccessionNumber} is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "deaccession",
              relatedEntityId: args.deaccessionId,
            });
          }
        }
      }
    } else {
      // Single-step approval
      await ctx.db.patch(args.deaccessionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      });

      // Log audit action
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: "approved",
        entityType: "deaccession",
        entityId: args.deaccessionId,
        changes: { status: "approved" },
      });

      // Notify all users with read access (optional - can be removed if too noisy)
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", deaccession.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        if (userOrg.userId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: deaccession.organizationId,
            userId: userOrg.userId,
            type: "workflow_approved",
            title: "Deaccession Approved",
            message: `Deaccession ${deaccession.deaccessionNumber} has been approved.`,
            relatedEntityType: "deaccession",
            relatedEntityId: args.deaccessionId,
          });
        }
      }

      await applyApprovedCollectionStatus(ctx, deaccession, userId);
    }

    return null;
  },
});

/**
 * Reject deaccession
 */
export const reject = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.approve_deaccession",
    );

    if (deaccession.status !== "pending") {
      throw new Error("Deaccession is not pending");
    }

    await ctx.db.patch(args.deaccessionId, {
      status: "rejected",
      approvedBy: userId,
      approvedAt: Date.now(),
      notes: args.comment
        ? `${deaccession.notes || ""}\nRejected: ${args.comment}`.trim()
        : deaccession.notes,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId,
      action: "rejected",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: { status: "rejected", comment: args.comment },
    });

    // Notify users who were involved in the workflow (from history)
    const history = deaccession.workflowHistory ?? [];
    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: deaccession.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Deaccession Rejected",
        message: `Deaccession ${deaccession.deaccessionNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "deaccession",
        relatedEntityId: args.deaccessionId,
      });
    }

    return null;
  },
});

/**
 * Get workflow history
 */
export const getWorkflowHistory = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.array(
    v.object({
      step: v.number(),
      approvedBy: v.id("users"),
      approvedAt: v.number(),
      comment: v.optional(v.string()),
      approverName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    const history = deaccession.workflowHistory ?? [];

    // Enrich with approver names
    const enrichedHistory = await Promise.all(
      history.map(async (item) => {
        const approver = await ctx.db.get(item.approvedBy);
        return {
          ...item,
          approverName: approver?.name || approver?.username || undefined,
        };
      }),
    );

    return enrichedHistory;
  },
});

export const getExportData = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.union(
    v.object({
      deaccession: v.object({
        _id: v.id("deaccessions"),
        deaccessionNumber: v.string(),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.string(),
        disposition: v.optional(v.string()),
        status: v.string(),
        notes: v.optional(v.string()),
        proceedsAmount: v.optional(v.number()),
        proceedsCurrency: v.optional(v.string()),
        proceedsRecipient: v.optional(v.string()),
        proceedsDate: v.optional(v.number()),
        proceedsNotes: v.optional(v.string()),
        approvedAt: v.optional(v.number()),
      }),
      collection: v.union(
        v.object({
          _id: v.id("collections"),
          title: v.string(),
          accessionNumber: v.optional(v.string()),
          description: v.optional(v.string()),
          primaryImageUrl: v.optional(v.string()),
        }),
        v.null(),
      ),
      organization: v.object({
        name: v.string(),
        slug: v.string(),
      }),
      workflowHistory: v.array(
        v.object({
          step: v.number(),
          approverName: v.string(),
          approvedAt: v.number(),
          comment: v.optional(v.string()),
        }),
      ),
      approverName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      return null;
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    const collection = await ctx.db.get(deaccession.collectionId);
    const organization = await ctx.db.get(deaccession.organizationId);

    if (!organization) {
      return null;
    }

    const history = deaccession.workflowHistory ?? [];
    const enrichedHistory = await Promise.all(
      history.map(async (item) => {
        const approver = await ctx.db.get(item.approvedBy);
        return {
          step: item.step,
          approverName: approver?.name || approver?.username || "Unknown",
          approvedAt: item.approvedAt,
          comment: item.comment,
        };
      }),
    );

    let approverName: string | undefined;
    if (deaccession.approvedBy) {
      const approver = await ctx.db.get(deaccession.approvedBy);
      approverName = approver?.name || approver?.username || undefined;
    }

    let primaryImageUrl: string | undefined;
    if (collection) {
      const primaryMedia = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .first();
      if (primaryMedia?.storageId) {
        primaryImageUrl =
          (await ctx.storage.getUrl(primaryMedia.storageId)) ?? undefined;
      }
    }

    return {
      deaccession: {
        _id: deaccession._id,
        deaccessionNumber: deaccession.deaccessionNumber,
        dateDeaccessioned: deaccession.dateDeaccessioned,
        reason: deaccession.reason,
        method: deaccession.method,
        disposition: deaccession.disposition,
        status: deaccession.status,
        notes: deaccession.notes,
        proceedsAmount: deaccession.proceedsAmount,
        proceedsCurrency: deaccession.proceedsCurrency,
        proceedsRecipient: deaccession.proceedsRecipient,
        proceedsDate: deaccession.proceedsDate,
        proceedsNotes: deaccession.proceedsNotes,
        approvedAt: deaccession.approvedAt,
      },
      collection: collection
        ? {
            _id: collection._id,
            title: collection.title,
            accessionNumber: collection.accessionNumber,
            description: collection.description,
            primaryImageUrl,
          }
        : null,
      organization: {
        name: organization.name,
        slug: organization.slug,
      },
      workflowHistory: enrichedHistory,
      approverName,
    };
  },
});

export const listForExport = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        deaccessionNumber: v.string(),
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.string(),
        disposition: v.optional(v.string()),
        status: v.string(),
        collectionTitle: v.string(),
        accessionNumber: v.optional(v.string()),
        proceedsAmount: v.optional(v.number()),
        proceedsCurrency: v.optional(v.string()),
        proceedsRecipient: v.optional(v.string()),
        proceedsDate: v.optional(v.number()),
        approverName: v.optional(v.string()),
        approvedAt: v.optional(v.number()),
      }),
    ),
    totals: v.object({
      count: v.number(),
      pendingCount: v.number(),
      approvedCount: v.number(),
      rejectedCount: v.number(),
      totalProceeds: v.number(),
    }),
    organization: v.object({
      name: v.string(),
      slug: v.string(),
    }),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    let results = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    if (args.status) {
      results = results.filter((d) => d.status === args.status);
    }
    if (args.dateFrom) {
      results = results.filter((d) => d.dateDeaccessioned >= args.dateFrom!);
    }
    if (args.dateTo) {
      results = results.filter((d) => d.dateDeaccessioned <= args.dateTo!);
    }

    results.sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned);

    const items = await Promise.all(
      results.map(async (d) => {
        const collection = await ctx.db.get(d.collectionId);
        let approverName: string | undefined;
        if (d.approvedBy) {
          const approver = await ctx.db.get(d.approvedBy);
          approverName = approver?.name || approver?.username || undefined;
        }
        return {
          deaccessionNumber: d.deaccessionNumber,
          dateDeaccessioned: d.dateDeaccessioned,
          reason: d.reason,
          method: d.method,
          disposition: d.disposition,
          status: d.status,
          collectionTitle: collection?.title || "Unknown",
          accessionNumber: collection?.accessionNumber,
          proceedsAmount: d.proceedsAmount,
          proceedsCurrency: d.proceedsCurrency,
          proceedsRecipient: d.proceedsRecipient,
          proceedsDate: d.proceedsDate,
          approverName,
          approvedAt: d.approvedAt,
        };
      }),
    );

    const pendingCount = results.filter((d) => d.status === "pending").length;
    const approvedCount = results.filter((d) => d.status === "approved").length;
    const rejectedCount = results.filter((d) => d.status === "rejected").length;
    const totalProceeds = results.reduce(
      (sum, d) => sum + (d.proceedsAmount || 0),
      0,
    );

    return {
      items,
      totals: {
        count: results.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        totalProceeds,
      },
      organization: {
        name: organization.name,
        slug: organization.slug,
      },
    };
  },
});

// ============================================
// Proceeds Accountability
// ============================================

/**
 * Record sale proceeds with receipt
 */
export const recordProceeds = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    amount: v.number(),
    currency: v.string(),
    recipient: v.string(),
    date: v.number(),
    notes: v.optional(v.string()),
    receiptDocument: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.deaccessionId, {
      proceedsAmount: args.amount,
      proceedsCurrency: args.currency,
      proceedsRecipient: args.recipient,
      proceedsDate: args.date,
      proceedsNotes: args.notes,
      proceedsReceiptDocument: args.receiptDocument,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId,
      action: "proceeds_recorded",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: { amount: args.amount, currency: args.currency },
    });

    return null;
  },
});

/**
 * Verify proceeds have been received and documented
 */
export const verifyProceeds = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    // Verify required fields are present for sales
    if (deaccession.method === "sale") {
      if (!deaccession.proceedsAmount) {
        throw new Error("Proceeds amount is required for sale deaccessions");
      }
      if (!deaccession.proceedsReceiptDocument) {
        throw new Error("Receipt document is required for sale deaccessions");
      }
    }

    await ctx.db.patch(args.deaccessionId, {
      proceedsVerified: true,
      proceedsVerifiedBy: userId,
      proceedsVerifiedAt: Date.now(),
      proceedsNotes: args.notes
        ? `${deaccession.proceedsNotes || ""}\nVerification: ${args.notes}`.trim()
        : deaccession.proceedsNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId,
      action: "proceeds_verified",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: { verified: true },
    });

    return null;
  },
});

// ============================================
// Regulatory Approval
// ============================================

/**
 * Request regulatory approval from external approver
 */
export const requestRegulatoryApproval = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    approverEmail: v.string(),
    approverName: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.object({
    token: v.string(),
    approvalUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    // Generate unique token for approval link
    const token = `reg-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    await ctx.db.patch(args.deaccessionId, {
      regulatoryApprovalRequired: true,
      regulatoryApprovalStatus: "requested",
      regulatoryApproverEmail: args.approverEmail,
      regulatoryApproverName: args.approverName,
      regulatoryApprovalRequestedAt: Date.now(),
      regulatoryApprovalToken: token,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId,
      action: "regulatory_approval_requested",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: {
        approverEmail: args.approverEmail,
        approverName: args.approverName,
      },
    });

    // Note: In production, this URL would be your actual domain
    const approvalUrl = `/api/regulatory-approval/${token}`;

    return { token, approvalUrl };
  },
});

/**
 * Record regulatory approval (can be called via external link or internally)
 */
export const recordRegulatoryApproval = mutation({
  args: {
    deaccessionId: v.optional(v.id("deaccessions")),
    token: v.optional(v.string()),
    approved: v.boolean(),
    notes: v.optional(v.string()),
    documents: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let deaccession: Doc<"deaccessions"> | null = null;

    if (args.deaccessionId) {
      deaccession = await ctx.db.get(args.deaccessionId);
    } else if (args.token) {
      // Find by token for external approval
      deaccession = await ctx.db
        .query("deaccessions")
        .withIndex("by_regulatory_token", (q) =>
          q.eq("regulatoryApprovalToken", args.token),
        )
        .first();
    } else {
      throw new Error("Either deaccessionId or token is required");
    }

    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    // If authenticated, check permission
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await requirePermission(
        ctx,
        deaccession.organizationId,
        "collections.update",
      );
    }

    await ctx.db.patch(deaccession._id, {
      regulatoryApprovalStatus: args.approved ? "approved" : "rejected",
      regulatoryApprovalReceivedAt: Date.now(),
      regulatoryApprovalNotes: args.notes,
      regulatoryApprovalDocuments: args.documents,
      regulatoryApprovalToken: undefined, // Clear token after use
    });

    if (userId) {
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: deaccession.organizationId,
        userId,
        action: args.approved
          ? "regulatory_approval_granted"
          : "regulatory_approval_denied",
        entityType: "deaccession",
        entityId: deaccession._id,
        changes: { approved: args.approved, notes: args.notes },
      });
    }

    // Notify organization users about the decision
    const userOrgs = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", deaccession.organizationId),
      )
      .collect();

    for (const userOrg of userOrgs) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: deaccession.organizationId,
        userId: userOrg.userId,
        type: args.approved
          ? "regulatory_approval_granted"
          : "regulatory_approval_denied",
        title: args.approved
          ? "Regulatory Approval Granted"
          : "Regulatory Approval Denied",
        message: `Regulatory approval for deaccession ${deaccession.deaccessionNumber} has been ${args.approved ? "granted" : "denied"}`,
        relatedEntityType: "deaccession",
        relatedEntityId: deaccession._id,
      });
    }

    return null;
  },
});

// ============================================
// Valuation/Appraisal Verification
// ============================================

/**
 * Link an appraisal to a deaccession and verify it meets requirements
 */
export const linkAppraisal = mutation({
  args: {
    deaccessionId: v.id("deaccessions"),
    appraisalId: v.id("appraisals"),
  },
  returns: v.object({
    valid: v.boolean(),
    message: v.string(),
    appraisalAge: v.optional(v.number()), // Age in days
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.update",
    );

    const appraisal = await ctx.db.get(args.appraisalId);
    if (!appraisal) {
      throw new Error("Appraisal not found");
    }

    // Verify appraisal belongs to same collection
    if (appraisal.collectionId !== deaccession.collectionId) {
      throw new Error("Appraisal does not belong to the deaccessioned item");
    }

    // Check appraisal age (max 2 years = 730 days)
    const maxAgeMs = 730 * 24 * 60 * 60 * 1000; // 2 years in ms
    const appraisalAge = Date.now() - appraisal.appraisalDate;
    const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));

    const isValid = appraisalAge <= maxAgeMs;

    await ctx.db.patch(args.deaccessionId, {
      appraisalId: args.appraisalId,
      appraisalValue: appraisal.value,
      appraisalDate: appraisal.appraisalDate,
      appraisalVerified: isValid,
      appraisalVerifiedBy: userId,
      appraisalVerifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: deaccession.organizationId,
      userId,
      action: "appraisal_linked",
      entityType: "deaccession",
      entityId: args.deaccessionId,
      changes: {
        appraisalId: args.appraisalId,
        value: appraisal.value,
        ageDays,
        valid: isValid,
      },
    });

    return {
      valid: isValid,
      message: isValid
        ? `Appraisal is valid (${ageDays} days old)`
        : `Appraisal is too old (${ageDays} days). Maximum age is 730 days (2 years).`,
      appraisalAge: ageDays,
    };
  },
});

/**
 * Get current appraisal for an item
 */
export const getCurrentAppraisal = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("appraisals"),
      appraisalDate: v.number(),
      appraiserName: v.string(),
      appraiserCompany: v.optional(v.string()),
      appraisalType: v.string(),
      value: v.number(),
      currency: v.string(),
      ageDays: v.number(),
      isValid: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    // Get most recent appraisal
    const appraisals = await ctx.db
      .query("appraisals")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    if (appraisals.length === 0) {
      return null;
    }

    // Sort by date descending and get most recent
    appraisals.sort((a, b) => b.appraisalDate - a.appraisalDate);
    const current = appraisals[0];
    if (!current) {
      return null;
    }

    const maxAgeMs = 730 * 24 * 60 * 60 * 1000;
    const appraisalAge = Date.now() - current.appraisalDate;
    const ageDays = Math.floor(appraisalAge / (24 * 60 * 60 * 1000));

    return {
      _id: current._id,
      appraisalDate: current.appraisalDate,
      appraiserName: current.appraiserName,
      appraiserCompany: current.appraiserCompany,
      appraisalType: current.appraisalType,
      value: current.value,
      currency: current.currency,
      ageDays,
      isValid: appraisalAge <= maxAgeMs,
    };
  },
});

/**
 * Check deaccession readiness - validates all requirements are met
 */
export const checkReadiness = query({
  args: {
    deaccessionId: v.id("deaccessions"),
  },
  returns: v.object({
    ready: v.boolean(),
    checks: v.array(
      v.object({
        name: v.string(),
        passed: v.boolean(),
        message: v.string(),
        required: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const deaccession = await ctx.db.get(args.deaccessionId);
    if (!deaccession) {
      throw new Error("Deaccession not found");
    }

    await requirePermission(
      ctx,
      deaccession.organizationId,
      "collections.read",
    );

    const checks: {
      name: string;
      passed: boolean;
      message: string;
      required: boolean;
    }[] = [];

    // Check 1: Appraisal verification (required)
    const hasValidAppraisal = deaccession.appraisalVerified === true;
    checks.push({
      name: "Appraisal Verification",
      passed: hasValidAppraisal,
      message: hasValidAppraisal
        ? "Valid appraisal linked"
        : "Requires valid appraisal (less than 2 years old)",
      required: true,
    });

    // Check 2: Proceeds documentation (required for sales)
    const isSale = deaccession.method === "sale";
    const hasProceedsDoc = isSale
      ? deaccession.proceedsVerified === true ||
        (deaccession.proceedsAmount != null &&
          deaccession.proceedsReceiptDocument != null)
      : true;
    checks.push({
      name: "Proceeds Documentation",
      passed: hasProceedsDoc,
      message: isSale
        ? hasProceedsDoc
          ? "Proceeds documented with receipt"
          : "Sale requires proceeds amount and receipt document"
        : "Not required (not a sale)",
      required: isSale,
    });

    // Check 3: Regulatory approval (if required)
    const needsRegulatory = deaccession.regulatoryApprovalRequired === true;
    const hasRegulatory = needsRegulatory
      ? deaccession.regulatoryApprovalStatus === "approved"
      : true;
    checks.push({
      name: "Regulatory Approval",
      passed: hasRegulatory,
      message: needsRegulatory
        ? hasRegulatory
          ? "Regulatory approval received"
          : "Awaiting regulatory approval"
        : "Not required",
      required: needsRegulatory,
    });

    // Check 4: Basic information
    const hasBasicInfo =
      deaccession.reason?.length > 0 && deaccession.disposition != null;
    checks.push({
      name: "Basic Information",
      passed: hasBasicInfo,
      message: hasBasicInfo
        ? "All required fields completed"
        : "Missing reason or disposition",
      required: true,
    });

    const requiredChecks = checks.filter((c) => c.required);
    const passedRequired = requiredChecks.filter((c) => c.passed);
    const ready = passedRequired.length === requiredChecks.length;

    return { ready, checks };
  },
});

// ============================================
// BULK EXPORT
// ============================================

/**
 * Bulk export deaccessions data for CSV/Excel export
 */
export const bulkExport = query({
  args: {
    deaccessionIds: v.array(v.id("deaccessions")),
  },
  returns: v.array(
    v.object({
      _id: v.id("deaccessions"),
      deaccessionNumber: v.string(),
      dateDeaccessioned: v.number(),
      reason: v.string(),
      method: v.string(),
      status: v.string(),
      disposition: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionTitle: v.optional(v.string()),
      collectionAccessionNumber: v.optional(v.string()),
      approvedByName: v.optional(v.string()),
      approvedAt: v.optional(v.number()),
      workflowStep: v.optional(v.number()),
      proceedsAmount: v.optional(v.number()),
      proceedsCurrency: v.optional(v.string()),
      proceedsRecipient: v.optional(v.string()),
      proceedsVerified: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const results: Array<{
      _id: Id<"deaccessions">;
      deaccessionNumber: string;
      dateDeaccessioned: number;
      reason: string;
      method: string;
      status: string;
      disposition?: string;
      notes?: string;
      collectionTitle?: string;
      collectionAccessionNumber?: string;
      approvedByName?: string;
      approvedAt?: number;
      workflowStep?: number;
      proceedsAmount?: number;
      proceedsCurrency?: string;
      proceedsRecipient?: string;
      proceedsVerified?: boolean;
    }> = [];

    for (const deaccessionId of args.deaccessionIds) {
      const deaccession = await ctx.db.get(deaccessionId);
      if (!deaccession) continue;

      await requirePermission(
        ctx,
        deaccession.organizationId,
        "collections.read",
      );

      // Get collection info
      let collectionTitle: string | undefined;
      let collectionAccessionNumber: string | undefined;
      if (deaccession.collectionId) {
        const collection = await ctx.db.get(deaccession.collectionId);
        if (collection) {
          collectionTitle = collection.title;
          collectionAccessionNumber = collection.accessionNumber;
        }
      }

      // Get approver name
      let approvedByName: string | undefined;
      if (deaccession.approvedBy) {
        const approver = await ctx.db.get(deaccession.approvedBy);
        approvedByName = approver?.name ?? approver?.username;
      }

      results.push({
        _id: deaccession._id,
        deaccessionNumber: deaccession.deaccessionNumber,
        dateDeaccessioned: deaccession.dateDeaccessioned,
        reason: deaccession.reason,
        method: deaccession.method,
        status: deaccession.status,
        disposition: deaccession.disposition,
        notes: deaccession.notes,
        collectionTitle,
        collectionAccessionNumber,
        approvedByName,
        approvedAt: deaccession.approvedAt,
        workflowStep: deaccession.workflowStep,
        proceedsAmount: deaccession.proceedsAmount,
        proceedsCurrency: deaccession.proceedsCurrency,
        proceedsRecipient: deaccession.proceedsRecipient,
        proceedsVerified: deaccession.proceedsVerified,
      });
    }

    return results;
  },
});
