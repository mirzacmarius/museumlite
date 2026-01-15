import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireFeatureAccess } from "./utils/featureGates";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
  requirePermission,
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

async function requireConservationAccess(
  ctx: any,
  organizationId: Id<"organizations">,
) {
  await requireFeatureAccess(ctx, organizationId, "conservation");
}

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
    await requireConservationAccess(ctx, args.organizationId);
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

    await requireConservationAccess(ctx, treatment.organizationId);
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

    await requireConservationAccess(ctx, collection.organizationId);
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

    await requireConservationAccess(ctx, treatment.organizationId);
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

// ============================================
// ATTACHMENT FUNCTIONS (MUS-337)
// ============================================

const attachmentTypeValidator = v.union(
  v.literal("before_photo"),
  v.literal("after_photo"),
  v.literal("during_photo"),
  v.literal("report"),
  v.literal("lab_notes"),
  v.literal("x_ray"),
  v.literal("uv_photo"),
  v.literal("microscopy"),
  v.literal("other"),
);

export const addAttachment = mutation({
  args: {
    treatmentId: v.id("conservationTreatments"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    attachmentType: attachmentTypeValidator,
    caption: v.optional(v.string()),
    notes: v.optional(v.string()),
    takenAt: v.optional(v.number()),
  },
  returns: v.id("conservationAttachments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      throw new Error("Treatment not found");
    }

    await requirePermission(
      ctx,
      treatment.organizationId,
      "collections.update",
    );

    const attachmentId = await ctx.db.insert("conservationAttachments", {
      organizationId: treatment.organizationId,
      treatmentId: args.treatmentId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      attachmentType: args.attachmentType,
      caption: args.caption,
      notes: args.notes,
      takenAt: args.takenAt,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: treatment.organizationId,
      userId,
      action: "uploaded_attachment",
      entityType: "conservationTreatment",
      entityId: args.treatmentId,
      changes: { fileName: args.fileName, attachmentType: args.attachmentType },
    });

    return attachmentId;
  },
});

export const removeAttachment = mutation({
  args: {
    attachmentId: v.id("conservationAttachments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    await requirePermission(
      ctx,
      attachment.organizationId,
      "collections.update",
    );

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: attachment.organizationId,
      userId,
      action: "deleted_attachment",
      entityType: "conservationTreatment",
      entityId: attachment.treatmentId,
      changes: { fileName: attachment.fileName },
    });

    return null;
  },
});

export const listAttachments = query({
  args: {
    treatmentId: v.id("conservationTreatments"),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAttachments"),
      storageId: v.id("_storage"),
      url: v.union(v.string(), v.null()),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      attachmentType: attachmentTypeValidator,
      caption: v.optional(v.string()),
      notes: v.optional(v.string()),
      takenAt: v.optional(v.number()),
      uploadedBy: v.id("users"),
      uploadedByName: v.optional(v.string()),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      return [];
    }

    await requireConservationAccess(ctx, treatment.organizationId);
    await requirePermission(ctx, treatment.organizationId, "collections.read");

    const attachments = await ctx.db
      .query("conservationAttachments")
      .withIndex("by_treatment", (q) => q.eq("treatmentId", args.treatmentId))
      .collect();

    return Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        const user = await ctx.db.get(attachment.uploadedBy);
        return {
          _id: attachment._id,
          storageId: attachment.storageId,
          url,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          attachmentType: attachment.attachmentType,
          caption: attachment.caption,
          notes: attachment.notes,
          takenAt: attachment.takenAt,
          uploadedBy: attachment.uploadedBy,
          uploadedByName: user?.name || user?.email,
          uploadedAt: attachment.uploadedAt,
        };
      }),
    );
  },
});

export const getAttachmentsByType = query({
  args: {
    treatmentId: v.id("conservationTreatments"),
    attachmentType: attachmentTypeValidator,
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAttachments"),
      url: v.union(v.string(), v.null()),
      fileName: v.string(),
      caption: v.optional(v.string()),
      takenAt: v.optional(v.number()),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const treatment = await ctx.db.get(args.treatmentId);
    if (!treatment) {
      return [];
    }

    await requireConservationAccess(ctx, treatment.organizationId);
    await requirePermission(ctx, treatment.organizationId, "collections.read");

    const attachments = await ctx.db
      .query("conservationAttachments")
      .withIndex("by_treatment_and_type", (q) =>
        q
          .eq("treatmentId", args.treatmentId)
          .eq("attachmentType", args.attachmentType),
      )
      .collect();

    return Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          _id: attachment._id,
          url,
          fileName: attachment.fileName,
          caption: attachment.caption,
          takenAt: attachment.takenAt,
          uploadedAt: attachment.uploadedAt,
        };
      }),
    );
  },
});

// ============================================
// ALERT RULE FUNCTIONS (MUS-338)
// ============================================

const triggerTypeValidator = v.union(
  v.literal("condition_threshold"),
  v.literal("treatment_overdue"),
  v.literal("assessment_due"),
  v.literal("urgent_treatment"),
  v.literal("environmental"),
);

const priorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

export const createAlertRule = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerType: triggerTypeValidator,
    conditionThreshold: v.optional(v.string()),
    daysOverdue: v.optional(v.number()),
    assessmentIntervalDays: v.optional(v.number()),
    priority: priorityValidator,
    notifyRoles: v.optional(v.array(v.id("roles"))),
    notifyUsers: v.optional(v.array(v.id("users"))),
    emailNotification: v.boolean(),
    inAppNotification: v.boolean(),
  },
  returns: v.id("conservationAlertRules"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireConservationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "organization.manage");

    const ruleId = await ctx.db.insert("conservationAlertRules", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      triggerType: args.triggerType,
      conditionThreshold: args.conditionThreshold,
      daysOverdue: args.daysOverdue,
      assessmentIntervalDays: args.assessmentIntervalDays,
      priority: args.priority,
      notifyRoles: args.notifyRoles,
      notifyUsers: args.notifyUsers,
      emailNotification: args.emailNotification,
      inAppNotification: args.inAppNotification,
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "conservationAlertRule",
      entityId: ruleId,
      changes: { name: args.name, triggerType: args.triggerType },
    });

    return ruleId;
  },
});

export const updateAlertRule = mutation({
  args: {
    ruleId: v.id("conservationAlertRules"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    triggerType: v.optional(triggerTypeValidator),
    conditionThreshold: v.optional(v.string()),
    daysOverdue: v.optional(v.number()),
    assessmentIntervalDays: v.optional(v.number()),
    priority: v.optional(priorityValidator),
    notifyRoles: v.optional(v.array(v.id("roles"))),
    notifyUsers: v.optional(v.array(v.id("users"))),
    emailNotification: v.optional(v.boolean()),
    inAppNotification: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Alert rule not found");
    }

    await requireConservationAccess(ctx, rule.organizationId);
    await requirePermission(ctx, rule.organizationId, "organization.manage");

    const { ruleId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    await ctx.db.patch(args.ruleId, {
      ...filteredUpdates,
      lastModifiedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: rule.organizationId,
      userId,
      action: "updated",
      entityType: "conservationAlertRule",
      entityId: args.ruleId,
      changes: filteredUpdates,
    });

    return null;
  },
});

export const deleteAlertRule = mutation({
  args: {
    ruleId: v.id("conservationAlertRules"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const rule = await ctx.db.get(args.ruleId);
    if (!rule) {
      throw new Error("Alert rule not found");
    }

    await requireConservationAccess(ctx, rule.organizationId);
    await requirePermission(ctx, rule.organizationId, "organization.manage");

    await ctx.db.patch(args.ruleId, { isActive: false });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: rule.organizationId,
      userId,
      action: "deactivated",
      entityType: "conservationAlertRule",
      entityId: args.ruleId,
      changes: { name: rule.name },
    });

    return null;
  },
});

export const listAlertRules = query({
  args: {
    organizationId: v.id("organizations"),
    activeOnly: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAlertRules"),
      name: v.string(),
      description: v.optional(v.string()),
      triggerType: triggerTypeValidator,
      conditionThreshold: v.optional(v.string()),
      daysOverdue: v.optional(v.number()),
      assessmentIntervalDays: v.optional(v.number()),
      priority: priorityValidator,
      emailNotification: v.boolean(),
      inAppNotification: v.boolean(),
      isActive: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireConservationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    if (args.activeOnly) {
      return ctx.db
        .query("conservationAlertRules")
        .withIndex("by_organization_and_active", (q) =>
          q.eq("organizationId", args.organizationId).eq("isActive", true),
        )
        .collect();
    }

    return ctx.db
      .query("conservationAlertRules")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
  },
});

// ============================================
// ALERT FUNCTIONS (MUS-338)
// ============================================

const alertTypeValidator = v.union(
  v.literal("condition_degraded"),
  v.literal("treatment_overdue"),
  v.literal("assessment_due"),
  v.literal("urgent_treatment"),
  v.literal("environmental_alert"),
  v.literal("manual"),
);

const alertStatusValidator = v.union(
  v.literal("active"),
  v.literal("acknowledged"),
  v.literal("resolved"),
  v.literal("dismissed"),
);

export const createAlert = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    treatmentId: v.optional(v.id("conservationTreatments")),
    alertType: alertTypeValidator,
    title: v.string(),
    description: v.string(),
    priority: priorityValidator,
  },
  returns: v.id("conservationAlerts"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireConservationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.update");

    const alertId = await ctx.db.insert("conservationAlerts", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      treatmentId: args.treatmentId,
      alertType: args.alertType,
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: "active",
      createdBy: userId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "conservationAlert",
      entityId: alertId,
      changes: { title: args.title, priority: args.priority },
    });

    return alertId;
  },
});

export const acknowledgeAlert = mutation({
  args: {
    alertId: v.id("conservationAlerts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.status !== "active") {
      throw new Error("Alert is not active");
    }

    await requireConservationAccess(ctx, alert.organizationId);
    await requirePermission(ctx, alert.organizationId, "collections.update");

    await ctx.db.patch(args.alertId, {
      status: "acknowledged",
      acknowledgedBy: userId,
      acknowledgedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: alert.organizationId,
      userId,
      action: "acknowledged",
      entityType: "conservationAlert",
      entityId: args.alertId,
      changes: { title: alert.title },
    });

    return null;
  },
});

export const resolveAlert = mutation({
  args: {
    alertId: v.id("conservationAlerts"),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.status === "resolved" || alert.status === "dismissed") {
      throw new Error("Alert is already closed");
    }

    await requireConservationAccess(ctx, alert.organizationId);
    await requirePermission(ctx, alert.organizationId, "collections.update");

    await ctx.db.patch(args.alertId, {
      status: "resolved",
      resolvedBy: userId,
      resolvedAt: Date.now(),
      resolutionNotes: args.resolutionNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: alert.organizationId,
      userId,
      action: "resolved",
      entityType: "conservationAlert",
      entityId: args.alertId,
      changes: { title: alert.title, resolutionNotes: args.resolutionNotes },
    });

    return null;
  },
});

export const dismissAlert = mutation({
  args: {
    alertId: v.id("conservationAlerts"),
    resolutionNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const alert = await ctx.db.get(args.alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.status === "resolved" || alert.status === "dismissed") {
      throw new Error("Alert is already closed");
    }

    await requireConservationAccess(ctx, alert.organizationId);
    await requirePermission(ctx, alert.organizationId, "collections.update");

    await ctx.db.patch(args.alertId, {
      status: "dismissed",
      resolvedBy: userId,
      resolvedAt: Date.now(),
      resolutionNotes: args.resolutionNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: alert.organizationId,
      userId,
      action: "dismissed",
      entityType: "conservationAlert",
      entityId: args.alertId,
      changes: { title: alert.title },
    });

    return null;
  },
});

export const listAlerts = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(alertStatusValidator),
    priority: v.optional(priorityValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAlerts"),
      collectionId: v.optional(v.id("collections")),
      collectionTitle: v.optional(v.string()),
      treatmentId: v.optional(v.id("conservationTreatments")),
      treatmentTitle: v.optional(v.string()),
      alertType: alertTypeValidator,
      title: v.string(),
      description: v.string(),
      priority: priorityValidator,
      status: alertStatusValidator,
      acknowledgedAt: v.optional(v.number()),
      resolvedAt: v.optional(v.number()),
      resolutionNotes: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireConservationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = args.limit ?? 100;

    const baseQuery = args.status
      ? ctx.db
          .query("conservationAlerts")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("conservationAlerts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const filteredQuery = args.priority
      ? baseQuery.filter((q) => q.eq(q.field("priority"), args.priority!))
      : baseQuery;

    const alerts = await filteredQuery.order("desc").take(limit);

    return Promise.all(
      alerts.map(async (alert) => {
        const collection = alert.collectionId
          ? await ctx.db.get(alert.collectionId)
          : null;
        const treatment = alert.treatmentId
          ? await ctx.db.get(alert.treatmentId)
          : null;

        return {
          _id: alert._id,
          collectionId: alert.collectionId,
          collectionTitle: collection?.title,
          treatmentId: alert.treatmentId,
          treatmentTitle: treatment?.title,
          alertType: alert.alertType,
          title: alert.title,
          description: alert.description,
          priority: alert.priority,
          status: alert.status,
          acknowledgedAt: alert.acknowledgedAt,
          resolvedAt: alert.resolvedAt,
          resolutionNotes: alert.resolutionNotes,
          createdAt: alert.createdAt,
        };
      }),
    );
  },
});

export const getActiveAlerts = query({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    treatmentId: v.optional(v.id("conservationTreatments")),
  },
  returns: v.array(
    v.object({
      _id: v.id("conservationAlerts"),
      alertType: alertTypeValidator,
      title: v.string(),
      priority: priorityValidator,
      status: alertStatusValidator,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireConservationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    let alertsQuery = ctx.db
      .query("conservationAlerts")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      );

    if (args.collectionId) {
      alertsQuery = alertsQuery.filter((q) =>
        q.eq(q.field("collectionId"), args.collectionId!),
      );
    }

    if (args.treatmentId) {
      alertsQuery = alertsQuery.filter((q) =>
        q.eq(q.field("treatmentId"), args.treatmentId!),
      );
    }

    const alerts = await alertsQuery.collect();

    return alerts.map((alert) => ({
      _id: alert._id,
      alertType: alert.alertType,
      title: alert.title,
      priority: alert.priority,
      status: alert.status,
      createdAt: alert.createdAt,
    }));
  },
});

export const getAlertsByPriority = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    critical: v.number(),
    high: v.number(),
    medium: v.number(),
    low: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireConservationAccess(ctx, args.organizationId);
    await requirePermission(ctx, args.organizationId, "collections.read");

    const activeAlerts = await ctx.db
      .query("conservationAlerts")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .collect();

    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: activeAlerts.length,
    };

    for (const alert of activeAlerts) {
      counts[alert.priority]++;
    }

    return counts;
  },
});

// ============================================
// INTERNAL CRON FUNCTIONS
// ============================================

export const checkOverdueTreatmentsInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const now = Date.now();

    for (const org of organizations) {
      const rules = await ctx.db
        .query("conservationAlertRules")
        .withIndex("by_organization_and_active", (q) =>
          q.eq("organizationId", org._id).eq("isActive", true),
        )
        .filter((q) => q.eq(q.field("triggerType"), "treatment_overdue"))
        .collect();

      for (const rule of rules) {
        const daysOverdue = rule.daysOverdue ?? 7;
        const threshold = now - daysOverdue * 24 * 60 * 60 * 1000;

        const overdueTreatments = await ctx.db
          .query("conservationTreatments")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", org._id).eq("status", "approved"),
          )
          .filter((q) => q.lt(q.field("performedAt"), threshold))
          .collect();

        for (const treatment of overdueTreatments) {
          const existingAlert = await ctx.db
            .query("conservationAlerts")
            .withIndex("by_treatment", (q) =>
              q.eq("treatmentId", treatment._id),
            )
            .filter((q) =>
              q.and(
                q.eq(q.field("alertType"), "treatment_overdue"),
                q.eq(q.field("status"), "active"),
              ),
            )
            .first();

          if (existingAlert) continue;

          const alertId = await ctx.db.insert("conservationAlerts", {
            organizationId: org._id,
            ruleId: rule._id,
            treatmentId: treatment._id,
            collectionId: treatment.collectionId,
            alertType: "treatment_overdue",
            title: `Overdue Treatment: ${treatment.title}`,
            description: `Treatment "${treatment.title}" has been approved but not started for over ${daysOverdue} days.`,
            priority: rule.priority,
            status: "active",
            createdAt: now,
          });

          if (rule.inAppNotification) {
            const usersToNotify: string[] = [];

            if (rule.notifyUsers?.length) {
              usersToNotify.push(...rule.notifyUsers);
            }

            if (rule.notifyRoles?.length) {
              for (const roleId of rule.notifyRoles) {
                const userOrgs = await ctx.db
                  .query("userOrganizations")
                  .withIndex("by_organization", (q) =>
                    q.eq("organizationId", org._id),
                  )
                  .filter((q) => q.eq(q.field("roleId"), roleId))
                  .collect();
                usersToNotify.push(...userOrgs.map((uo) => uo.userId));
              }
            }

            const uniqueUsers = [...new Set(usersToNotify)];
            for (const userId of uniqueUsers) {
              await ctx.runMutation(internal.audit.createNotificationInternal, {
                organizationId: org._id,
                userId: userId as typeof treatment.performedBy,
                type: "conservation_alert",
                title: `Overdue Treatment Alert`,
                message: `Treatment "${treatment.title}" is overdue and requires attention.`,
                relatedEntityType: "conservationAlert",
                relatedEntityId: alertId,
              });
            }
          }
        }
      }
    }

    return null;
  },
});

export const checkAssessmentsDueInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const now = Date.now();

    for (const org of organizations) {
      const rules = await ctx.db
        .query("conservationAlertRules")
        .withIndex("by_organization_and_active", (q) =>
          q.eq("organizationId", org._id).eq("isActive", true),
        )
        .filter((q) => q.eq(q.field("triggerType"), "assessment_due"))
        .collect();

      for (const rule of rules) {
        const intervalDays = rule.assessmentIntervalDays ?? 365;
        const threshold = now - intervalDays * 24 * 60 * 60 * 1000;

        const collections = await ctx.db
          .query("collections")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", org._id).eq("status", "active"),
          )
          .collect();

        for (const collection of collections) {
          const lastAssessment = await ctx.db
            .query("conservationTreatments")
            .withIndex("by_collection", (q) =>
              q.eq("collectionId", collection._id),
            )
            .filter((q) => q.eq(q.field("treatmentType"), "assessment"))
            .order("desc")
            .first();

          const lastAssessmentTime = lastAssessment?.performedAt ?? 0;

          if (lastAssessmentTime < threshold) {
            const existingAlert = await ctx.db
              .query("conservationAlerts")
              .withIndex("by_collection", (q) =>
                q.eq("collectionId", collection._id),
              )
              .filter((q) =>
                q.and(
                  q.eq(q.field("alertType"), "assessment_due"),
                  q.eq(q.field("status"), "active"),
                ),
              )
              .first();

            if (existingAlert) continue;

            const daysSinceAssessment = Math.floor(
              (now - lastAssessmentTime) / (24 * 60 * 60 * 1000),
            );

            const alertId = await ctx.db.insert("conservationAlerts", {
              organizationId: org._id,
              ruleId: rule._id,
              collectionId: collection._id,
              alertType: "assessment_due",
              title: `Assessment Due: ${collection.title}`,
              description: lastAssessment
                ? `Last assessment was ${daysSinceAssessment} days ago. Periodic assessment recommended.`
                : `No assessment record found. Initial assessment recommended.`,
              priority: rule.priority,
              status: "active",
              createdAt: now,
            });

            if (rule.inAppNotification) {
              const usersToNotify: string[] = [];

              if (rule.notifyUsers?.length) {
                usersToNotify.push(...rule.notifyUsers);
              }

              if (rule.notifyRoles?.length) {
                for (const roleId of rule.notifyRoles) {
                  const userOrgs = await ctx.db
                    .query("userOrganizations")
                    .withIndex("by_organization", (q) =>
                      q.eq("organizationId", org._id),
                    )
                    .filter((q) => q.eq(q.field("roleId"), roleId))
                    .collect();
                  usersToNotify.push(...userOrgs.map((uo) => uo.userId));
                }
              }

              const uniqueUsers = [...new Set(usersToNotify)];
              for (const notifyUserId of uniqueUsers) {
                await ctx.runMutation(
                  internal.audit.createNotificationInternal,
                  {
                    organizationId: org._id,
                    userId: notifyUserId as typeof collection.catalogedBy,
                    type: "conservation_alert",
                    title: `Assessment Due Alert`,
                    message: `Object "${collection.title}" requires a conservation assessment.`,
                    relatedEntityType: "conservationAlert",
                    relatedEntityId: alertId,
                  },
                );
              }
            }
          }
        }
      }
    }

    return null;
  },
});
