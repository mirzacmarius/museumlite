import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  requirePermission,
  canInitiateWorkflow,
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
} from "./utils/permissions";

const treatmentTypeValidator = v.union(
  v.literal("routine"),
  v.literal("stabilization"),
  v.literal("restoration"),
  v.literal("cleaning"),
  v.literal("repair"),
  v.literal("assessment"),
  v.literal("other"),
);

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationTreatments"),
      _creationTime: v.number(),
      treatmentType: treatmentTypeValidator,
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    const results = await Promise.all(
      treatments.map(async (treatment) => {
        const collection = await ctx.db.get(treatment.collectionId);
        const user = await ctx.db.get(treatment.performedBy);
        return {
          _id: treatment._id,
          _creationTime: treatment._creationTime,
          treatmentType: treatment.treatmentType,
          title: treatment.title,
          description: treatment.description,
          performedAt: treatment.performedAt,
          performedByName:
            treatment.performedByName || user?.name || user?.email,
          notes: treatment.notes,
          collectionId: treatment.collectionId,
          collectionTitle: collection?.title,
        };
      }),
    );

    return results;
  },
});

export const get = query({
  args: {
    id: v.id("conservationTreatments"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conservationTreatments"),
      _creationTime: v.number(),
      treatmentType: treatmentTypeValidator,
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedBy: v.id("users"),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.id);
    if (!treatment) {
      return null;
    }

    await requirePermission(ctx, treatment.organizationId, "collections.read");

    const collection = await ctx.db.get(treatment.collectionId);
    const user = await ctx.db.get(treatment.performedBy);

    return {
      _id: treatment._id,
      _creationTime: treatment._creationTime,
      treatmentType: treatment.treatmentType,
      title: treatment.title,
      description: treatment.description,
      performedAt: treatment.performedAt,
      performedBy: treatment.performedBy,
      performedByName: treatment.performedByName || user?.name || user?.email,
      notes: treatment.notes,
      collectionId: treatment.collectionId,
      organizationId: treatment.organizationId,
      collectionTitle: collection?.title,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("conservationTreatments"),
    treatmentType: v.optional(treatmentTypeValidator),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    performedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.id);
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    if (treatment.status === "completed" || treatment.status === "rejected") {
      throw new Error("Cannot update completed or rejected treatment");
    }

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await ctx.db.patch(args.id, filteredUpdates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: treatment.organizationId,
      userId,
      action: "updated",
      entityType: "conservationTreatment",
      entityId: args.id,
      changes: filteredUpdates,
    });

    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("conservationTreatments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.id);
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.delete",
    );

    if (treatment.status === "in_progress") {
      throw new Error("Cannot delete treatment in progress");
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: treatment.organizationId,
      userId,
      action: "deleted",
      entityType: "conservationTreatment",
      entityId: args.id,
      changes: { title: treatment.title },
    });

    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * List conservation treatments for a collection
 */
export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationTreatments"),
      treatmentType: v.union(
        v.literal("routine"),
        v.literal("stabilization"),
        v.literal("restoration"),
        v.literal("cleaning"),
        v.literal("repair"),
        v.literal("assessment"),
        v.literal("other"),
      ),
      title: v.string(),
      description: v.string(),
      performedAt: v.number(),
      performedByName: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const treatments = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .collect();

    // Enrich with performer names
    const enrichedTreatments = await Promise.all(
      treatments.map(async (treatment) => {
        const user = await ctx.db.get(treatment.performedBy);
        return {
          _id: treatment._id,
          treatmentType: treatment.treatmentType,
          title: treatment.title,
          description: treatment.description,
          performedAt: treatment.performedAt,
          performedByName:
            treatment.performedByName || user?.name || user?.email,
          notes: treatment.notes,
        };
      }),
    );

    return enrichedTreatments;
  },
});

/**
 * Create a conservation treatment record
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    treatmentType: v.union(
      v.literal("routine"),
      v.literal("stabilization"),
      v.literal("restoration"),
      v.literal("cleaning"),
      v.literal("repair"),
      v.literal("assessment"),
      v.literal("other"),
    ),
    title: v.string(),
    description: v.string(),
    performedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("conservationTreatments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const canInitiate = await canInitiateWorkflow(
      ctx,
      collection.organizationId,
      "conservation",
    );

    if (!canInitiate) {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.update",
      );
    }

    const user = await ctx.db.get(userId);

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", collection.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "conservation"))
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

    const treatmentId = await ctx.db.insert("conservationTreatments", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      treatmentType: args.treatmentType,
      title: args.title,
      description: args.description,
      performedBy: userId,
      performedByName: user?.name || user?.email || undefined,
      performedAt: args.performedAt ?? Date.now(),
      notes: args.notes,
      status: workflowConfig ? "proposed" : "completed",
      workflowStep: workflowConfig ? 1 : undefined,
      workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
      createdBy: userId,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "conservationTreatment",
      entityId: treatmentId,
      changes: {
        title: args.title,
        status: workflowConfig ? "proposed" : "completed",
      },
    });

    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        collection.organizationId,
        "conservation",
        1,
      );

      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: collection.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "New Conservation Treatment Requires Approval",
            message: `Conservation treatment "${args.title}" is pending your approval at step 1.`,
            relatedEntityType: "conservationTreatment",
            relatedEntityId: treatmentId,
          });
        }
      }
    }

    return treatmentId;
  },
});

export const approve = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "proposed") {
      throw new Error("Treatment is not pending approval");
    }

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", treatment.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "conservation"))
      .first();

    if (workflowConfig) {
      const currentStep = treatment.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        treatment.organizationId,
        "conservation",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      const history = treatment.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });

      const isLastStep = currentStep >= workflowConfig.steps.length;

      if (isLastStep) {
        await ctx.db.patch(args.treatmentId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: treatment.organizationId,
          userId,
          action: "approved",
          entityType: "conservationTreatment",
          entityId: args.treatmentId,
          changes: { status: "approved", step: currentStep },
        });

        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: treatment.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Conservation Treatment Approved",
            message: `Conservation treatment "${treatment.title}" has been approved.`,
            relatedEntityType: "conservationTreatment",
            relatedEntityId: args.treatmentId,
          });
        }
      } else {
        await ctx.db.patch(args.treatmentId, {
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: treatment.organizationId,
          userId,
          action: "step_approved",
          entityType: "conservationTreatment",
          entityId: args.treatmentId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          treatment.organizationId,
          "conservation",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: treatment.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Conservation Treatment Requires Your Approval",
              message: `Conservation treatment "${treatment.title}" is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "conservationTreatment",
              relatedEntityId: args.treatmentId,
            });
          }
        }
      }
    } else {
      await requirePermission(
        ctx,
        treatment.organizationId,
        "collections.update",
      );

      await ctx.db.patch(args.treatmentId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: treatment.organizationId,
        userId,
        action: "approved",
        entityType: "conservationTreatment",
        entityId: args.treatmentId,
        changes: { status: "approved" },
      });
    }

    return null;
  },
});

export const reject = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "proposed") {
      throw new Error("Treatment is not pending approval");
    }

    const currentStep = treatment.workflowStep ?? 1;
    const canApprove = await canApproveAtStep(
      ctx,
      treatment.organizationId,
      "conservation",
      currentStep,
    );

    if (!canApprove) {
      await requirePermission(
        ctx,
        treatment.organizationId,
        "collections.update",
      );
    }

    const history = treatment.workflowHistory ?? [];
    history.push({
      step: currentStep,
      approvedBy: userId,
      approvedAt: Date.now(),
      comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
    });

    await ctx.db.patch(args.treatmentId, {
      status: "rejected",
      workflowHistory: history,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: treatment.organizationId,
      userId,
      action: "rejected",
      entityType: "conservationTreatment",
      entityId: args.treatmentId,
      changes: { status: "rejected", comment: args.comment },
    });

    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: treatment.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Conservation Treatment Rejected",
        message: `Conservation treatment "${treatment.title}" has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "conservationTreatment",
        relatedEntityId: args.treatmentId,
      });
    }

    return null;
  },
});

export const startProgress = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "approved") {
      throw new Error("Treatment must be approved before starting");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.treatmentId, {
      status: "in_progress",
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: treatment.organizationId,
      userId,
      action: "started",
      entityType: "conservationTreatment",
      entityId: args.treatmentId,
      changes: { status: "in_progress" },
    });

    return null;
  },
});

export const complete = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    if (treatment.status !== "in_progress" && treatment.status !== "approved") {
      throw new Error("Treatment must be approved or in progress to complete");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    const updates: {
      status: "completed";
      notes?: string;
      performedAt: number;
    } = {
      status: "completed",
      performedAt: Date.now(),
    };

    if (args.notes) {
      updates.notes = treatment.notes
        ? `${treatment.notes}\n\nCompletion notes: ${args.notes}`
        : args.notes;
    }

    await ctx.db.patch(args.treatmentId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: treatment.organizationId,
      userId,
      action: "completed",
      entityType: "conservationTreatment",
      entityId: args.treatmentId,
      changes: { status: "completed" },
    });

    return null;
  },
});

export const getWorkflowHistory = query({
  args: {
    treatmentId: v.id("conservationTreatments"),
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
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Conservation treatment not found");
    }

    await requirePermission(ctx, treatment.organizationId, "collections.read");

    const history = treatment.workflowHistory ?? [];

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
