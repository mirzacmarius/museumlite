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
 * Generate accession number
 */
async function generateAccessionNumber(
  ctx: any,
  organizationId: Id<"organizations">,
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const format = org.settings?.accessionNumberFormat;
  const autoGenerate = org.settings?.autoGenerateAccessionNumbers ?? false;

  if (!autoGenerate || !format) {
    throw new Error("Accession number generation not configured");
  }

  const year = new Date().getFullYear();
  const orgSlug = org.slug.toUpperCase().substring(0, 3);

  // Count existing accessions this year
  const existing = await ctx.db
    .query("accessions")
    .withIndex("by_organization", (q: any) =>
      q.eq("organizationId", organizationId),
    )
    .filter((q: any) =>
      q.eq(
        q.field("accessionNumber"),
        `${orgSlug}-${year}-001`,
      ),
    )
    .collect();

  const sequence = String(existing.length + 1).padStart(3, "0");
  return `${orgSlug}-${year}-${sequence}`;
}

/**
 * Create accession record
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.optional(v.string()),
    dateReceived: v.number(),
    source: v.string(),
    method: v.union(
      v.literal("purchase"),
      v.literal("gift"),
      v.literal("loan"),
      v.literal("transfer"),
    ),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("accessions"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user can initiate workflow
    const canInitiate = await canInitiateWorkflow(
      ctx,
      args.organizationId,
      "accession",
    );

    if (!canInitiate) {
      throw new Error("Permission denied: cannot initiate accession workflow");
    }

    // Generate or use provided accession number
    let accessionNumber: string;
    if (args.accessionNumber) {
      accessionNumber = args.accessionNumber;
    } else {
      accessionNumber = await generateAccessionNumber(
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
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
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

    const accessionId = await ctx.db.insert("accessions", {
      organizationId: args.organizationId,
      accessionNumber,
      dateReceived: args.dateReceived,
      source: args.source,
      method: args.method,
      cost: args.cost,
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
      entityType: "accession",
      entityId: accessionId,
      changes: { accessionNumber, status: workflowConfig ? "pending" : "approved" },
    });

    // If workflow exists, notify users who can approve step 1
    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "accession",
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
            title: "New Accession Requires Approval",
            message: `Accession ${accessionNumber} is pending your approval at step 1.`,
            relatedEntityType: "accession",
            relatedEntityId: accessionId,
          });
        }
      }
    }

    // If no workflow config, auto-create collection object
    if (!workflowConfig) {
      await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
        accessionId,
      });
    }

    return accessionId;
  },
});

/**
 * List accessions with filters
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
        _id: v.id("accessions"),
        accessionNumber: v.string(),
        dateReceived: v.number(),
        source: v.string(),
        method: v.union(
          v.literal("purchase"),
          v.literal("gift"),
          v.literal("loan"),
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
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    // Collect all results for search filtering
    let allResults = await query.collect();

    // Apply search filter if provided
    if (args.search && args.search.trim().length > 0) {
      const searchLower = args.search.toLowerCase();
      // Get collection titles for accessions to include in search
      const accessionsWithCollectionInfo = await Promise.all(
        allResults.map(async (accession) => {
          let collectionTitle = "";
          if (accession.collectionId) {
            const collection = await ctx.db.get(accession.collectionId);
            collectionTitle = collection?.title || "";
          }
          
          return { ...accession, collectionTitle };
        }),
      );
      
      allResults = accessionsWithCollectionInfo
        .filter((accession) => {
          return (
            accession.accessionNumber?.toLowerCase().includes(searchLower) ||
            accession.source?.toLowerCase().includes(searchLower) ||
            accession.notes?.toLowerCase().includes(searchLower) ||
            accession.collectionTitle?.toLowerCase().includes(searchLower) ||
            accession.method?.toLowerCase().includes(searchLower) ||
            false
          );
        })
        .map(({ collectionTitle, ...accession }) => accession); // Remove temporary field
    }

    // Sort by date received (newest first)
    allResults.sort((a, b) => b.dateReceived - a.dateReceived);

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
        accessionNumber: item.accessionNumber,
        dateReceived: item.dateReceived,
        source: item.source,
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
 * Get accession details
 */
export const get = query({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("accessions"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      collectionId: v.optional(v.id("collections")),
      accessionNumber: v.string(),
      dateReceived: v.number(),
      source: v.string(),
      method: v.union(
        v.literal("purchase"),
        v.literal("gift"),
        v.literal("loan"),
        v.literal("transfer"),
      ),
      cost: v.optional(v.number()),
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
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      return null;
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.read",
    );

    // Ensure workflowHistory is always an array (even if empty)
    return {
      ...accession,
      workflowHistory: accession.workflowHistory ?? [],
    };
  },
});

/**
 * Update accession (before approval)
 */
export const update = mutation({
  args: {
    accessionId: v.id("accessions"),
    source: v.optional(v.string()),
    method: v.optional(
      v.union(
        v.literal("purchase"),
        v.literal("gift"),
        v.literal("loan"),
        v.literal("transfer"),
      ),
    ),
    cost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Can only update if pending
    if (accession.status !== "pending") {
      throw new Error("Can only update pending accessions");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    const updates: {
      source?: string;
      method?: "purchase" | "gift" | "loan" | "transfer";
      cost?: number;
      notes?: string;
    } = {};

    if (args.source !== undefined) updates.source = args.source;
    if (args.method !== undefined) updates.method = args.method;
    if (args.cost !== undefined) updates.cost = args.cost;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.accessionId, updates);

    return null;
  },
});

/**
 * Submit for approval
 */
export const submitForApproval = mutation({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    // Reset workflow step if needed
    await ctx.db.patch(args.accessionId, {
      workflowStep: 1,
    });

    return null;
  },
});

/**
 * Approve accession at current step
 */
export const approve = mutation({
  args: {
    accessionId: v.id("accessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.approve_accession",
    );

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    // Get workflow config
    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", accession.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "accession"))
      .first();

    if (workflowConfig) {
      // Multi-step workflow
      const currentStep = accession.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        accession.organizationId,
        "accession",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      // Add to workflow history
      const history = accession.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });

      // Check if this is the last step
      const isLastStep = currentStep >= workflowConfig.steps.length;

      if (isLastStep) {
        // Approve and create collection
        await ctx.db.patch(args.accessionId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        });

        // Log audit action
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: accession.organizationId,
          userId,
          action: "approved",
          entityType: "accession",
          entityId: args.accessionId,
          changes: { status: "approved", step: currentStep },
        });

        // Notify users who were involved in the workflow (from history)
        // The creator is in history[0] (step 0) if it exists
        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: accession.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Accession Approved",
            message: `Accession ${accession.accessionNumber} has been fully approved and added to the collection.`,
            relatedEntityType: "accession",
            relatedEntityId: args.accessionId,
          });
        }

        // Create collection object
        await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
          accessionId: args.accessionId,
        });
      } else {
        // Move to next step
        await ctx.db.patch(args.accessionId, {
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        // Log audit action
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: accession.organizationId,
          userId,
          action: "step_approved",
          entityType: "accession",
          entityId: args.accessionId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        // Notify users who can approve the next step
        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          accession.organizationId,
          "accession",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: accession.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Accession Requires Your Approval",
              message: `Accession ${accession.accessionNumber} is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "accession",
              relatedEntityId: args.accessionId,
            });
          }
        }
      }
    } else {
      // Single-step approval
      await ctx.db.patch(args.accessionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      });

      // Log audit action
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: accession.organizationId,
        userId,
        action: "approved",
        entityType: "accession",
        entityId: args.accessionId,
        changes: { status: "approved" },
      });

      // Notify all users with read access (optional - can be removed if too noisy)
      const userOrgs = await ctx.db
        .query("userOrganizations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", accession.organizationId),
        )
        .collect();

      for (const userOrg of userOrgs) {
        if (userOrg.userId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: accession.organizationId,
            userId: userOrg.userId,
            type: "workflow_approved",
            title: "Accession Approved",
            message: `Accession ${accession.accessionNumber} has been approved and added to the collection.`,
            relatedEntityType: "accession",
            relatedEntityId: args.accessionId,
          });
        }
      }

      // Create collection object
      await ctx.runMutation(internal.accessions.createCollectionFromAccession, {
        accessionId: args.accessionId,
      });
    }

    return null;
  },
});

/**
 * Reject accession
 */
export const reject = mutation({
  args: {
    accessionId: v.id("accessions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.approve_accession",
    );

    if (accession.status !== "pending") {
      throw new Error("Accession is not pending");
    }

    await ctx.db.patch(args.accessionId, {
      status: "rejected",
      approvedBy: userId,
      approvedAt: Date.now(),
      notes: args.comment
        ? `${accession.notes || ""}\nRejected: ${args.comment}`.trim()
        : accession.notes,
    });

    // Log audit action
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId,
      action: "rejected",
      entityType: "accession",
      entityId: args.accessionId,
      changes: { status: "rejected", comment: args.comment },
    });

    // Notify users who were involved in the workflow (from history)
    const history = accession.workflowHistory ?? [];
    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: accession.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Accession Rejected",
        message: `Accession ${accession.accessionNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "accession",
        relatedEntityId: args.accessionId,
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
    accessionId: v.id("accessions"),
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
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.read",
    );

    const history = accession.workflowHistory ?? [];

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

/**
 * Internal: Create collection object from approved accession
 */
export const createCollectionFromAccession = internalMutation({
  args: {
    accessionId: v.id("accessions"),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) {
      throw new Error("Accession not found");
    }

    if (accession.status !== "approved") {
      throw new Error("Accession must be approved");
    }

    if (accession.collectionId) {
      // Collection already created
      return accession.collectionId;
    }

    // Get first user as fallback for catalogedBy
    const firstUser = await ctx.db.query("users").first();

    // Create collection object
    const collectionId = await ctx.db.insert("collections", {
      organizationId: accession.organizationId,
      accessionNumber: accession.accessionNumber,
      title: `Accession ${accession.accessionNumber}`, // Default title
      status: "active",
      catalogedBy: accession.approvedBy ?? firstUser?._id!,
      catalogedAt: accession.approvedAt ?? Date.now(),
    });

    // Link accession to collection
    await ctx.db.patch(args.accessionId, {
      collectionId,
    });

    return collectionId;
  },
});

