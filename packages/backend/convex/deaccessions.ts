import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  requirePermission,
  canInitiateWorkflow,
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
} from "./utils/permissions";

/**
 * Generate deaccession number
 */
async function generateDeaccessionNumber(
  ctx: any,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const year = new Date().getFullYear();
  const orgSlug = org.slug.toUpperCase().substring(0, 3);

  // Count existing deaccessions this year
  const existing = await ctx.db
    .query("deaccessions")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    )
    .filter((q) =>
      q.eq(
        q.field("deaccessionNumber"),
        `DA-${orgSlug}-${year}-001`,
      ),
    )
    .collect();

  const sequence = String(existing.length + 1).padStart(3, "0");
  return `DA-${orgSlug}-${year}-${sequence}`;
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
    disposition: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("deaccessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify collection exists and belongs to organization
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    if (collection.organizationId !== args.organizationId) {
      throw new Error("Collection does not belong to organization");
    }

    // Check if user can initiate workflow
    const canInitiate = await canInitiateWorkflow(
      ctx,
      args.organizationId,
      "deaccession",
    );

    if (!canInitiate) {
      throw new Error("Permission denied: cannot initiate deaccession workflow");
    }

    // Generate or use provided deaccession number
    let deaccessionNumber: string;
    if (args.deaccessionNumber) {
      deaccessionNumber = args.deaccessionNumber;
    } else {
      deaccessionNumber = await generateDeaccessionNumber(
        ctx,
        args.organizationId,
      );
    }

    // Get workflow config
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "deaccession"))
      .first();

    // Store creator in workflow history for notification purposes
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
      status: workflowConfig ? "pending" : "approved", // Auto-approve if no workflow
      workflowStep: workflowConfig ? 1 : undefined,
      workflowHistory,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "deaccession",
      entityId: deaccessionId,
      changes: { deaccessionNumber, status: workflowConfig ? "pending" : "approved" },
    });

    // If workflow exists, notify users who can approve step 1
    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "deaccession",
        1,
      );

      // Create notifications for approvers
      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          // Don't notify the creator
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

    // If no workflow config, auto-mark collection as deaccessioned
    if (!workflowConfig) {
      await ctx.db.patch(args.collectionId, {
        status: "deaccessioned",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    }

    return deaccessionId;
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
        dateDeaccessioned: v.number(),
        reason: v.string(),
        method: v.union(
          v.literal("sale"),
          v.literal("donation"),
          v.literal("destruction"),
          v.literal("transfer"),
        ),
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

    let query = ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    // Collect all results for search filtering
    let allResults = await query.collect();

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      allResults = allResults.filter((deaccession) => {
        return (
          deaccession.deaccessionNumber?.toLowerCase().includes(searchLower) ||
          deaccession.reason?.toLowerCase().includes(searchLower) ||
          deaccession.disposition?.toLowerCase().includes(searchLower) ||
          deaccession.notes?.toLowerCase().includes(searchLower) ||
          false
        );
      });
    }

    // Sort by date deaccessioned (newest first)
    allResults.sort((a, b) => b.dateDeaccessioned - a.dateDeaccessioned);

    // Handle pagination manually
    const cursor = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor, 10)
      : 0;
    const startIndex = cursor;
    const endIndex = Math.min(
      startIndex + args.paginationOpts.numItems,
      allResults.length,
    );
    const page = allResults.slice(startIndex, endIndex);

    return {
      page: page.map((item) => ({
        _id: item._id,
        deaccessionNumber: item.deaccessionNumber,
        collectionId: item.collectionId,
        dateDeaccessioned: item.dateDeaccessioned,
        reason: item.reason,
        method: item.method,
        status: item.status,
        workflowStep: item.workflowStep,
      })),
      isDone: endIndex >= allResults.length,
      continueCursor: endIndex.toString(),
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

    // Ensure workflowHistory is always an array (even if empty)
    return {
      ...deaccession,
      workflowHistory: deaccession.workflowHistory ?? [],
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
    disposition: v.optional(v.string()),
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
      disposition?: string;
      notes?: string;
    } = {};

    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.method !== undefined) updates.method = args.method;
    if (args.disposition !== undefined) updates.disposition = args.disposition;
    if (args.notes !== undefined) updates.notes = args.notes;

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

        // Mark collection as deaccessioned
        await ctx.db.patch(deaccession.collectionId, {
          status: "deaccessioned",
          lastModifiedBy: userId,
          lastModifiedAt: Date.now(),
        });
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

      // Mark collection as deaccessioned
      await ctx.db.patch(deaccession.collectionId, {
        status: "deaccessioned",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
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

