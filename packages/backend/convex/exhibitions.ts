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

export const listByOrganization = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      _creationTime: v.number(),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    const results = await Promise.all(
      exhibitions.map(async (exhibition) => {
        const collection = await ctx.db.get(exhibition.collectionId);
        return {
          _id: exhibition._id,
          _creationTime: exhibition._creationTime,
          title: exhibition.title,
          location: exhibition.location,
          startDate: exhibition.startDate,
          endDate: exhibition.endDate,
          isCurrent: exhibition.isCurrent,
          isLoan: exhibition.isLoan,
          loanVenue: exhibition.loanVenue,
          notes: exhibition.notes,
          collectionId: exhibition.collectionId,
          collectionTitle: collection?.title,
        };
      }),
    );

    return results;
  },
});

export const get = query({
  args: {
    id: v.id("exhibitions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("exhibitions"),
      _creationTime: v.number(),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
      collectionId: v.id("collections"),
      organizationId: v.id("organizations"),
      collectionTitle: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      return null;
    }

    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const collection = await ctx.db.get(exhibition.collectionId);

    return {
      _id: exhibition._id,
      _creationTime: exhibition._creationTime,
      title: exhibition.title,
      location: exhibition.location,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      isCurrent: exhibition.isCurrent,
      isLoan: exhibition.isLoan,
      loanVenue: exhibition.loanVenue,
      notes: exhibition.notes,
      collectionId: exhibition.collectionId,
      organizationId: exhibition.organizationId,
      collectionTitle: collection?.title,
    };
  },
});

export const update = mutation({
  args: {
    id: v.id("exhibitions"),
    title: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    isCurrent: v.optional(v.boolean()),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibition.status === "closed" || exhibition.status === "rejected") {
      throw new Error("Cannot update closed or rejected exhibition");
    }

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined),
    );

    if (filteredUpdates.isCurrent === true) {
      const currentExhibitions = await ctx.db
        .query("exhibitions")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", exhibition.collectionId),
        )
        .filter((q) => q.eq(q.field("isCurrent"), true))
        .collect();

      for (const ex of currentExhibitions) {
        if (ex._id !== args.id) {
          await ctx.db.patch(ex._id, { isCurrent: false });
        }
      }
    }

    await ctx.db.patch(args.id, filteredUpdates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "updated",
      entityType: "exhibition",
      entityId: args.id,
      changes: filteredUpdates,
    });

    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.delete",
    );

    if (exhibition.status === "active") {
      throw new Error("Cannot delete active exhibition");
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "deleted",
      entityType: "exhibition",
      entityId: args.id,
      changes: { title: exhibition.title },
    });

    await ctx.db.delete(args.id);
    return null;
  },
});

/**
 * List exhibitions for a collection
 */
export const list = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      title: v.string(),
      location: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      isCurrent: v.boolean(),
      isLoan: v.optional(v.boolean()),
      loanVenue: v.optional(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .collect();

    return exhibitions.map((exhibition) => ({
      _id: exhibition._id,
      title: exhibition.title,
      location: exhibition.location,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      isCurrent: exhibition.isCurrent,
      isLoan: exhibition.isLoan,
      loanVenue: exhibition.loanVenue,
      notes: exhibition.notes,
    }));
  },
});

/**
 * Create an exhibition record
 */
export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    title: v.string(),
    location: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isCurrent: v.boolean(),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("exhibitions"),
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
      "exhibition",
    );

    if (!canInitiate) {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.update",
      );
    }

    if (args.isCurrent) {
      const currentExhibitions = await ctx.db
        .query("exhibitions")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .filter((q) => q.eq(q.field("isCurrent"), true))
        .collect();

      for (const exhibition of currentExhibitions) {
        await ctx.db.patch(exhibition._id, { isCurrent: false });
      }
    }

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", collection.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "exhibition"))
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

    const exhibitionId = await ctx.db.insert("exhibitions", {
      collectionId: args.collectionId,
      organizationId: collection.organizationId,
      title: args.title,
      location: args.location,
      startDate: args.startDate,
      endDate: args.endDate,
      isCurrent: args.isCurrent,
      isLoan: args.isLoan,
      loanVenue: args.loanVenue,
      notes: args.notes,
      status: workflowConfig ? "proposed" : "active",
      workflowStep: workflowConfig ? 1 : undefined,
      workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
      createdBy: userId,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "created",
      entityType: "exhibition",
      entityId: exhibitionId,
      changes: {
        title: args.title,
        status: workflowConfig ? "proposed" : "active",
      },
    });

    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        collection.organizationId,
        "exhibition",
        1,
      );

      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: collection.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "New Exhibition Requires Approval",
            message: `Exhibition "${args.title}" is pending your approval at step 1.`,
            relatedEntityType: "exhibition",
            relatedEntityId: exhibitionId,
          });
        }
      }
    }

    return exhibitionId;
  },
});

export const approve = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    if (exhibition.status !== "proposed") {
      throw new Error("Exhibition is not pending approval");
    }

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", exhibition.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "exhibition"))
      .first();

    if (workflowConfig) {
      const currentStep = exhibition.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        exhibition.organizationId,
        "exhibition",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      const history = exhibition.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });

      const isLastStep = currentStep >= workflowConfig.steps.length;

      if (isLastStep) {
        await ctx.db.patch(args.exhibitionId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: exhibition.organizationId,
          userId,
          action: "approved",
          entityType: "exhibition",
          entityId: args.exhibitionId,
          changes: { status: "approved", step: currentStep },
        });

        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: exhibition.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Exhibition Approved",
            message: `Exhibition "${exhibition.title}" has been approved.`,
            relatedEntityType: "exhibition",
            relatedEntityId: args.exhibitionId,
          });
        }
      } else {
        await ctx.db.patch(args.exhibitionId, {
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: exhibition.organizationId,
          userId,
          action: "step_approved",
          entityType: "exhibition",
          entityId: args.exhibitionId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          exhibition.organizationId,
          "exhibition",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: exhibition.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Exhibition Requires Your Approval",
              message: `Exhibition "${exhibition.title}" is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "exhibition",
              relatedEntityId: args.exhibitionId,
            });
          }
        }
      }
    } else {
      await requirePermission(
        ctx,
        exhibition.organizationId,
        "collections.update",
      );

      await ctx.db.patch(args.exhibitionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: exhibition.organizationId,
        userId,
        action: "approved",
        entityType: "exhibition",
        entityId: args.exhibitionId,
        changes: { status: "approved" },
      });
    }

    return null;
  },
});

export const reject = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    if (exhibition.status !== "proposed") {
      throw new Error("Exhibition is not pending approval");
    }

    const currentStep = exhibition.workflowStep ?? 1;
    const canApprove = await canApproveAtStep(
      ctx,
      exhibition.organizationId,
      "exhibition",
      currentStep,
    );

    if (!canApprove) {
      await requirePermission(
        ctx,
        exhibition.organizationId,
        "collections.update",
      );
    }

    const history = exhibition.workflowHistory ?? [];
    history.push({
      step: currentStep,
      approvedBy: userId,
      approvedAt: Date.now(),
      comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
    });

    await ctx.db.patch(args.exhibitionId, {
      status: "rejected",
      workflowHistory: history,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "rejected",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "rejected", comment: args.comment },
    });

    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: exhibition.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Exhibition Rejected",
        message: `Exhibition "${exhibition.title}" has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "exhibition",
        relatedEntityId: args.exhibitionId,
      });
    }

    return null;
  },
});

export const activate = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    if (exhibition.status !== "approved") {
      throw new Error("Exhibition must be approved before activation");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.exhibitionId, {
      status: "active",
      isCurrent: true,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "activated",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "active" },
    });

    return null;
  },
});

export const close = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    if (exhibition.status !== "active") {
      throw new Error("Exhibition must be active to close");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    await ctx.db.patch(args.exhibitionId, {
      status: "closed",
      isCurrent: false,
      endDate: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "closed",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "closed" },
    });

    return null;
  },
});

export const getWorkflowHistory = query({
  args: {
    exhibitionId: v.id("exhibitions"),
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
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const history = exhibition.workflowHistory ?? [];

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
