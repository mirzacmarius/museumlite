import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireFeatureAccess } from "./utils/featureGates";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
  requirePermission,
} from "./utils/permissions";

async function requireExhibitionAccess(
  ctx: any,
  organizationId: Id<"organizations">,
) {
  await requireFeatureAccess(ctx, organizationId, "exhibitions");
}

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
    await requireExhibitionAccess(ctx, args.organizationId);
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
      status: v.optional(
        v.union(
          v.literal("proposed"),
          v.literal("approved"),
          v.literal("active"),
          v.literal("closed"),
          v.literal("rejected"),
          v.literal("installing"),
          v.literal("deinstalling"),
        ),
      ),
      workflowStep: v.optional(v.number()),
      totalWorkflowSteps: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      approverName: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
      creatorName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.id);
    if (!exhibition) {
      return null;
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);

    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const collection = await ctx.db.get(exhibition.collectionId);

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", exhibition.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "exhibition"))
      .first();

    const approver = exhibition.approvedBy
      ? await ctx.db.get(exhibition.approvedBy)
      : null;
    const creator = exhibition.createdBy
      ? await ctx.db.get(exhibition.createdBy)
      : null;

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
      status: exhibition.status,
      workflowStep: exhibition.workflowStep,
      totalWorkflowSteps: workflowConfig?.steps.length,
      approvedBy: exhibition.approvedBy,
      approvedAt: exhibition.approvedAt,
      approverName: approver?.name ?? approver?.username ?? undefined,
      createdBy: exhibition.createdBy,
      creatorName: creator?.name ?? creator?.username ?? undefined,
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

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

    await requireExhibitionAccess(ctx, collection.organizationId);

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

    await requireExhibitionAccess(ctx, collection.organizationId);

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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

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
    skipInstallationCheck: v.optional(v.boolean()),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

    if (exhibition.status !== "approved") {
      throw new Error("Exhibition must be approved before activation");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    // Check if all required installation tasks are complete
    if (!args.skipInstallationCheck) {
      const checklist = exhibition.installationChecklist ?? [];
      const incompleteRequired = checklist.filter(
        (t) => t.required && !t.completed,
      );

      if (incompleteRequired.length > 0) {
        throw new Error(
          `Cannot activate: ${incompleteRequired.length} required installation tasks remain`,
        );
      }
    }

    // Move all exhibition objects to installed status and update their locations
    const exhibitionObjects = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const obj of exhibitionObjects) {
      const newLocationId = obj.exhibitionLocationId ?? exhibition.locationId;

      await ctx.db.patch(obj._id, {
        status: "installed",
        installedAt: Date.now(),
        installedBy: userId,
      });

      if (newLocationId) {
        await ctx.db.patch(obj.collectionId, {
          currentLocationId: newLocationId,
        });
      }
    }

    await ctx.db.patch(args.exhibitionId, {
      status: "active",
      isCurrent: true,
      activatedAt: Date.now(),
      activatedBy: userId,
      installationCompletedAt: exhibition.installationCompletedAt ?? Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "activated",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "active", objectsInstalled: exhibitionObjects.length },
    });

    return null;
  },
});

export const close = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    skipDeinstallationCheck: v.optional(v.boolean()),
    returnObjectsToOriginalLocations: v.optional(v.boolean()),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

    if (
      exhibition.status !== "active" &&
      exhibition.status !== "deinstalling"
    ) {
      throw new Error("Exhibition must be active or deinstalling to close");
    }

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    // Check if all required deinstallation tasks are complete
    if (!args.skipDeinstallationCheck) {
      const checklist = exhibition.deinstallationChecklist ?? [];
      const incompleteRequired = checklist.filter(
        (t) => t.required && !t.completed,
      );

      if (incompleteRequired.length > 0) {
        throw new Error(
          `Cannot close: ${incompleteRequired.length} required deinstallation tasks remain`,
        );
      }
    }

    // Handle objects - return them to original locations if requested
    const exhibitionObjects = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .collect();

    const notReturnedObjects = exhibitionObjects.filter(
      (obj) => obj.status !== "returned",
    );

    if (args.returnObjectsToOriginalLocations !== false) {
      // Return all objects that haven't been returned yet
      for (const obj of notReturnedObjects) {
        // Deinstall if still installed
        if (obj.status === "installed") {
          await ctx.db.patch(obj._id, {
            status: "deinstalled",
            deinstalledAt: Date.now(),
            deinstalledBy: userId,
          });
        }

        // Return to original location
        if (obj.originalLocationId) {
          await ctx.db.patch(obj.collectionId, {
            currentLocationId: obj.originalLocationId,
          });
        }

        await ctx.db.patch(obj._id, {
          status: "returned",
          returnedToOriginalLocation: true,
          returnedAt: Date.now(),
        });
      }
    } else if (notReturnedObjects.length > 0 && !args.skipDeinstallationCheck) {
      throw new Error(
        `Cannot close: ${notReturnedObjects.length} objects have not been returned`,
      );
    }

    await ctx.db.patch(args.exhibitionId, {
      status: "closed",
      isCurrent: false,
      endDate: Date.now(),
      deinstallationCompletedAt: Date.now(),
      closedAt: Date.now(),
      closedBy: userId,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "closed",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: {
        status: "closed",
        objectsReturned: notReturnedObjects.length,
      },
    });

    return null;
  },
});

export const checkScheduleConflicts = query({
  args: {
    collectionId: v.id("collections"),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    excludeExhibitionId: v.optional(v.id("exhibitions")),
  },
  returns: v.object({
    hasConflicts: v.boolean(),
    conflicts: v.array(
      v.object({
        type: v.union(v.literal("exhibition"), v.literal("loan")),
        id: v.string(),
        title: v.string(),
        startDate: v.number(),
        endDate: v.optional(v.number()),
        status: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return { hasConflicts: false, conflicts: [] };
    }

    await requireExhibitionAccess(ctx, collection.organizationId);

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const conflicts: Array<{
      type: "exhibition" | "loan";
      id: string;
      title: string;
      startDate: number;
      endDate?: number;
      status: string;
    }> = [];

    const proposedStart = args.startDate;
    const proposedEnd = args.endDate ?? Number.MAX_SAFE_INTEGER;

    const dateRangesOverlap = (
      start1: number,
      end1: number,
      start2: number,
      end2: number,
    ) => start1 < end2 && start2 < end1;

    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    for (const ex of exhibitions) {
      if (args.excludeExhibitionId && ex._id === args.excludeExhibitionId) {
        continue;
      }

      if (ex.status === "rejected" || ex.status === "closed") {
        continue;
      }

      const exEnd = ex.endDate ?? Number.MAX_SAFE_INTEGER;
      if (dateRangesOverlap(proposedStart, proposedEnd, ex.startDate, exEnd)) {
        conflicts.push({
          type: "exhibition",
          id: ex._id,
          title: ex.title,
          startDate: ex.startDate,
          endDate: ex.endDate,
          status: ex.status ?? "active",
        });
      }
    }

    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();

    for (const item of loanItems) {
      const loan = await ctx.db.get(item.loanId);
      if (!loan) continue;

      if (loan.status === "cancelled" || loan.status === "returned") {
        continue;
      }

      const loanEnd = loan.endDate ?? Number.MAX_SAFE_INTEGER;
      if (
        dateRangesOverlap(proposedStart, proposedEnd, loan.startDate, loanEnd)
      ) {
        conflicts.push({
          type: "loan",
          id: loan._id,
          title: `${loan.type === "incoming" ? "Incoming" : "Outgoing"} Loan: ${loan.loanNumber}`,
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);

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

export const listDocuments = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitionDocuments"),
      storageId: v.id("_storage"),
      documentType: v.union(
        v.literal("floor_plan"),
        v.literal("label"),
        v.literal("press_release"),
        v.literal("checklist"),
        v.literal("other"),
      ),
      fileName: v.string(),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
      uploaderName: v.optional(v.string()),
      url: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      return [];
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);

    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const documents = await ctx.db
      .query("exhibitionDocuments")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .collect();

    const enrichedDocs = await Promise.all(
      documents.map(async (doc) => {
        const uploader = await ctx.db.get(doc.uploadedBy);
        const url = await ctx.storage.getUrl(doc.storageId);
        return {
          _id: doc._id,
          storageId: doc.storageId,
          documentType: doc.documentType,
          fileName: doc.fileName,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
          uploaderName: uploader?.name ?? uploader?.username ?? undefined,
          url: url ?? undefined,
        };
      }),
    );

    return enrichedDocs;
  },
});

export const uploadDocument = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    storageId: v.id("_storage"),
    documentType: v.union(
      v.literal("floor_plan"),
      v.literal("label"),
      v.literal("press_release"),
      v.literal("checklist"),
      v.literal("other"),
    ),
    fileName: v.string(),
  },
  returns: v.id("exhibitionDocuments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    const documentId = await ctx.db.insert("exhibitionDocuments", {
      exhibitionId: args.exhibitionId,
      storageId: args.storageId,
      documentType: args.documentType,
      fileName: args.fileName,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "uploaded_document",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { fileName: args.fileName, documentType: args.documentType },
    });

    return documentId;
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("exhibitionDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const exhibition = await ctx.db.get(document.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);

    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.delete",
    );

    await ctx.storage.delete(document.storageId);
    await ctx.db.delete(args.documentId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "deleted_document",
      entityType: "exhibition",
      entityId: document.exhibitionId,
      changes: { fileName: document.fileName },
    });

    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================================================
// Installation Phase Management
// ============================================================================

const installationTaskValidator = v.object({
  taskId: v.string(),
  task: v.string(),
  required: v.boolean(),
  completed: v.boolean(),
  completedBy: v.optional(v.id("users")),
  completedAt: v.optional(v.number()),
  notes: v.optional(v.string()),
});

/**
 * Initialize or update installation checklist for an exhibition
 */
export const setInstallationChecklist = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
      }),
    ),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibition.status !== "proposed" && exhibition.status !== "approved") {
      throw new Error("Cannot modify checklist after installation has started");
    }

    const checklistItems = args.checklist.map((item) => ({
      taskId: item.taskId,
      task: item.task,
      required: item.required,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      notes: undefined,
    }));

    await ctx.db.patch(args.exhibitionId, {
      installationChecklist: checklistItems,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "set_installation_checklist",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskCount: args.checklist.length },
    });

    return null;
  },
});

/**
 * Start the installation phase for an approved exhibition
 */
export const startInstallation = mutation({
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibition.status !== "approved") {
      throw new Error(
        "Exhibition must be approved before starting installation",
      );
    }

    await ctx.db.patch(args.exhibitionId, {
      status: "installing",
      installationStartedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "started_installation",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "installing" },
    });

    return null;
  },
});

/**
 * Complete an installation checklist task
 */
export const completeInstallationTask = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    taskId: v.string(),
    notes: v.optional(v.string()),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (
      exhibition.status !== "installing" &&
      exhibition.status !== "approved"
    ) {
      throw new Error("Exhibition is not in installation phase");
    }

    const checklist = exhibition.installationChecklist ?? [];
    const taskIndex = checklist.findIndex((t) => t.taskId === args.taskId);

    if (taskIndex === -1) {
      throw new Error("Task not found in installation checklist");
    }

    const existingTask = checklist[taskIndex];
    if (!existingTask) {
      throw new Error("Task not found");
    }

    checklist[taskIndex] = {
      taskId: existingTask.taskId,
      task: existingTask.task,
      required: existingTask.required,
      completed: true,
      completedBy: userId,
      completedAt: Date.now(),
      notes: args.notes,
    };

    await ctx.db.patch(args.exhibitionId, {
      installationChecklist: checklist,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "completed_installation_task",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskId: args.taskId, task: existingTask.task },
    });

    return null;
  },
});

/**
 * Uncomplete an installation checklist task
 */
export const uncompleteInstallationTask = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    taskId: v.string(),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (
      exhibition.status !== "installing" &&
      exhibition.status !== "approved"
    ) {
      throw new Error("Exhibition is not in installation phase");
    }

    const checklist = exhibition.installationChecklist ?? [];
    const taskIndex = checklist.findIndex((t) => t.taskId === args.taskId);

    if (taskIndex === -1) {
      throw new Error("Task not found in installation checklist");
    }

    const existingTask = checklist[taskIndex];
    if (!existingTask) {
      throw new Error("Task not found");
    }

    checklist[taskIndex] = {
      taskId: existingTask.taskId,
      task: existingTask.task,
      required: existingTask.required,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      notes: undefined,
    };

    await ctx.db.patch(args.exhibitionId, {
      installationChecklist: checklist,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "uncompleted_installation_task",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskId: args.taskId },
    });

    return null;
  },
});

/**
 * Check if all required installation tasks are complete
 */
export const checkInstallationReadiness = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    isReady: v.boolean(),
    totalTasks: v.number(),
    completedTasks: v.number(),
    requiredTasksRemaining: v.number(),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
        completed: v.boolean(),
        completedBy: v.optional(v.id("users")),
        completedAt: v.optional(v.number()),
        completedByName: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const checklist = exhibition.installationChecklist ?? [];
    const totalTasks = checklist.length;
    const completedTasks = checklist.filter((t) => t.completed).length;
    const requiredTasksRemaining = checklist.filter(
      (t) => t.required && !t.completed,
    ).length;

    const enrichedChecklist = await Promise.all(
      checklist.map(async (task) => {
        const completer = task.completedBy
          ? await ctx.db.get(task.completedBy)
          : null;
        return {
          taskId: task.taskId,
          task: task.task,
          required: task.required,
          completed: task.completed,
          completedBy: task.completedBy,
          completedAt: task.completedAt,
          completedByName: completer?.name ?? completer?.username ?? undefined,
          notes: task.notes,
        };
      }),
    );

    return {
      isReady: requiredTasksRemaining === 0,
      totalTasks,
      completedTasks,
      requiredTasksRemaining,
      checklist: enrichedChecklist,
    };
  },
});

/**
 * Complete installation and mark ready for activation
 */
export const completeInstallation = mutation({
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibition.status !== "installing") {
      throw new Error("Exhibition is not in installation phase");
    }

    // Check if all required tasks are complete
    const checklist = exhibition.installationChecklist ?? [];
    const incompleteRequired = checklist.filter(
      (t) => t.required && !t.completed,
    );

    if (incompleteRequired.length > 0) {
      throw new Error(
        `Cannot complete installation: ${incompleteRequired.length} required tasks remain`,
      );
    }

    await ctx.db.patch(args.exhibitionId, {
      status: "approved", // Back to approved, ready for activation
      installationCompletedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "completed_installation",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "approved" },
    });

    return null;
  },
});

// ============================================================================
// Deinstallation Workflow
// ============================================================================

/**
 * Initialize or update deinstallation checklist for an exhibition
 */
export const setDeinstallationChecklist = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
      }),
    ),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    const checklistItems = args.checklist.map((item) => ({
      taskId: item.taskId,
      task: item.task,
      required: item.required,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
      notes: undefined,
    }));

    await ctx.db.patch(args.exhibitionId, {
      deinstallationChecklist: checklistItems,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "set_deinstallation_checklist",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskCount: args.checklist.length },
    });

    return null;
  },
});

/**
 * Start the deinstallation phase for an active exhibition
 */
export const startDeinstallation = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    notes: v.optional(v.string()),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibition.status !== "active") {
      throw new Error("Exhibition must be active to start deinstallation");
    }

    await ctx.db.patch(args.exhibitionId, {
      status: "deinstalling",
      deinstallationStartedAt: Date.now(),
      deinstallationNotes: args.notes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "started_deinstallation",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "deinstalling" },
    });

    return null;
  },
});

/**
 * Complete a deinstallation checklist task
 */
export const completeDeinstallationTask = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    taskId: v.string(),
    notes: v.optional(v.string()),
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

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibition.status !== "deinstalling") {
      throw new Error("Exhibition is not in deinstallation phase");
    }

    const checklist = exhibition.deinstallationChecklist ?? [];
    const taskIndex = checklist.findIndex((t) => t.taskId === args.taskId);

    if (taskIndex === -1) {
      throw new Error("Task not found in deinstallation checklist");
    }

    const existingTask = checklist[taskIndex];
    if (!existingTask) {
      throw new Error("Task not found");
    }

    checklist[taskIndex] = {
      taskId: existingTask.taskId,
      task: existingTask.task,
      required: existingTask.required,
      completed: true,
      completedBy: userId,
      completedAt: Date.now(),
      notes: args.notes,
    };

    await ctx.db.patch(args.exhibitionId, {
      deinstallationChecklist: checklist,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "completed_deinstallation_task",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { taskId: args.taskId, task: existingTask.task },
    });

    return null;
  },
});

/**
 * Check deinstallation readiness
 */
export const checkDeinstallationReadiness = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    isReady: v.boolean(),
    totalTasks: v.number(),
    completedTasks: v.number(),
    requiredTasksRemaining: v.number(),
    objectsNotReturned: v.number(),
    checklist: v.array(
      v.object({
        taskId: v.string(),
        task: v.string(),
        required: v.boolean(),
        completed: v.boolean(),
        completedBy: v.optional(v.id("users")),
        completedAt: v.optional(v.number()),
        completedByName: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const checklist = exhibition.deinstallationChecklist ?? [];
    const totalTasks = checklist.length;
    const completedTasks = checklist.filter((t) => t.completed).length;
    const requiredTasksRemaining = checklist.filter(
      (t) => t.required && !t.completed,
    ).length;

    // Check if all objects have been returned
    const exhibitionObjects = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .collect();

    const objectsNotReturned = exhibitionObjects.filter(
      (obj) => obj.status !== "returned",
    ).length;

    const enrichedChecklist = await Promise.all(
      checklist.map(async (task) => {
        const completer = task.completedBy
          ? await ctx.db.get(task.completedBy)
          : null;
        return {
          taskId: task.taskId,
          task: task.task,
          required: task.required,
          completed: task.completed,
          completedBy: task.completedBy,
          completedAt: task.completedAt,
          completedByName: completer?.name ?? completer?.username ?? undefined,
          notes: task.notes,
        };
      }),
    );

    return {
      isReady: requiredTasksRemaining === 0 && objectsNotReturned === 0,
      totalTasks,
      completedTasks,
      requiredTasksRemaining,
      objectsNotReturned,
      checklist: enrichedChecklist,
    };
  },
});

// ============================================================================
// Exhibition Object Location Tracking
// ============================================================================

/**
 * Add an object to an exhibition
 */
export const addExhibitionObject = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    collectionId: v.id("collections"),
    originalLocationId: v.optional(v.id("locations")),
    exhibitionLocationId: v.optional(v.id("locations")),
  },
  returns: v.id("exhibitionObjects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection object not found");
    }

    if (collection.organizationId !== exhibition.organizationId) {
      throw new Error("Object does not belong to the same organization");
    }

    // Check if object is already in this exhibition
    const existingEntry = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
      .first();

    if (existingEntry) {
      throw new Error("Object is already added to this exhibition");
    }

    // Get current location from collection if not provided
    const originalLocation =
      args.originalLocationId ?? collection.currentLocationId ?? undefined;

    const objectId = await ctx.db.insert("exhibitionObjects", {
      exhibitionId: args.exhibitionId,
      organizationId: exhibition.organizationId,
      collectionId: args.collectionId,
      originalLocationId: originalLocation,
      exhibitionLocationId: args.exhibitionLocationId ?? exhibition.locationId,
      status: "pending",
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "added_exhibition_object",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { collectionId: args.collectionId },
    });

    return objectId;
  },
});

/**
 * Remove an object from an exhibition (before installation)
 */
export const removeExhibitionObject = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibitionObject = await ctx.db.get(args.exhibitionObjectId);
    if (!exhibitionObject) {
      throw new Error("Exhibition object not found");
    }

    const exhibition = await ctx.db.get(exhibitionObject.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibitionObject.status !== "pending") {
      throw new Error("Cannot remove object that has been installed");
    }

    await ctx.db.delete(args.exhibitionObjectId);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "removed_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: { collectionId: exhibitionObject.collectionId },
    });

    return null;
  },
});

/**
 * Install an object in the exhibition (mark as placed and update location)
 */
export const installObject = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    conditionNotes: v.optional(v.string()),
    exhibitionLocationId: v.optional(v.id("locations")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibitionObject = await ctx.db.get(args.exhibitionObjectId);
    if (!exhibitionObject) {
      throw new Error("Exhibition object not found");
    }

    const exhibition = await ctx.db.get(exhibitionObject.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibitionObject.status !== "pending") {
      throw new Error("Object is not in pending status");
    }

    // Update exhibition object status
    await ctx.db.patch(args.exhibitionObjectId, {
      status: "installed",
      installedAt: Date.now(),
      installedBy: userId,
      conditionAtInstallation: args.conditionNotes,
      exhibitionLocationId:
        args.exhibitionLocationId ??
        exhibitionObject.exhibitionLocationId ??
        exhibition.locationId,
    });

    // Update the collection object's location to the exhibition location
    const newLocationId =
      args.exhibitionLocationId ??
      exhibitionObject.exhibitionLocationId ??
      exhibition.locationId;

    if (newLocationId) {
      await ctx.db.patch(exhibitionObject.collectionId, {
        currentLocationId: newLocationId,
      });
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "installed_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: {
        collectionId: exhibitionObject.collectionId,
        currentLocationId: newLocationId,
      },
    });

    return null;
  },
});

/**
 * Deinstall an object from the exhibition
 */
export const deinstallObject = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    conditionNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibitionObject = await ctx.db.get(args.exhibitionObjectId);
    if (!exhibitionObject) {
      throw new Error("Exhibition object not found");
    }

    const exhibition = await ctx.db.get(exhibitionObject.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (exhibitionObject.status !== "installed") {
      throw new Error("Object is not installed");
    }

    await ctx.db.patch(args.exhibitionObjectId, {
      status: "deinstalled",
      deinstalledAt: Date.now(),
      deinstalledBy: userId,
      conditionAtDeinstallation: args.conditionNotes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "deinstalled_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: {
        collectionId: exhibitionObject.collectionId,
        conditionNotes: args.conditionNotes,
      },
    });

    return null;
  },
});

/**
 * Return an object to its original location after exhibition
 */
export const returnObjectToOriginalLocation = mutation({
  args: {
    exhibitionObjectId: v.id("exhibitionObjects"),
    overrideLocationId: v.optional(v.id("locations")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibitionObject = await ctx.db.get(args.exhibitionObjectId);
    if (!exhibitionObject) {
      throw new Error("Exhibition object not found");
    }

    const exhibition = await ctx.db.get(exhibitionObject.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    if (
      exhibitionObject.status !== "deinstalled" &&
      exhibitionObject.status !== "installed"
    ) {
      throw new Error(
        "Object must be installed or deinstalled before returning",
      );
    }

    const returnLocation =
      args.overrideLocationId ?? exhibitionObject.originalLocationId;

    // Update collection object's location back to original
    if (returnLocation) {
      await ctx.db.patch(exhibitionObject.collectionId, {
        currentLocationId: returnLocation,
      });
    }

    await ctx.db.patch(args.exhibitionObjectId, {
      status: "returned",
      returnedToOriginalLocation: true,
      returnedAt: Date.now(),
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "returned_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: {
        collectionId: exhibitionObject.collectionId,
        returnedToLocationId: returnLocation,
      },
    });

    return null;
  },
});

/**
 * List objects in an exhibition
 */
export const listExhibitionObjects = query({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitionObjects"),
      collectionId: v.id("collections"),
      collectionTitle: v.optional(v.string()),
      collectionAccessionNumber: v.optional(v.string()),
      originalLocationId: v.optional(v.id("locations")),
      originalLocationName: v.optional(v.string()),
      exhibitionLocationId: v.optional(v.id("locations")),
      exhibitionLocationName: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("installed"),
        v.literal("deinstalled"),
        v.literal("returned"),
      ),
      installedAt: v.optional(v.number()),
      installedByName: v.optional(v.string()),
      conditionAtInstallation: v.optional(v.string()),
      deinstalledAt: v.optional(v.number()),
      deinstalledByName: v.optional(v.string()),
      conditionAtDeinstallation: v.optional(v.string()),
      returnedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      return [];
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(ctx, exhibition.organizationId, "collections.read");

    const exhibitionObjects = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .collect();

    const results = await Promise.all(
      exhibitionObjects.map(async (obj) => {
        const collection = await ctx.db.get(obj.collectionId);
        const originalLocation = obj.originalLocationId
          ? await ctx.db.get(obj.originalLocationId)
          : null;
        const exhibitionLocation = obj.exhibitionLocationId
          ? await ctx.db.get(obj.exhibitionLocationId)
          : null;
        const installer = obj.installedBy
          ? await ctx.db.get(obj.installedBy)
          : null;
        const deinstaller = obj.deinstalledBy
          ? await ctx.db.get(obj.deinstalledBy)
          : null;

        return {
          _id: obj._id,
          collectionId: obj.collectionId,
          collectionTitle: collection?.title,
          collectionAccessionNumber: collection?.accessionNumber,
          originalLocationId: obj.originalLocationId,
          originalLocationName: originalLocation?.name,
          exhibitionLocationId: obj.exhibitionLocationId,
          exhibitionLocationName: exhibitionLocation?.name,
          status: obj.status,
          installedAt: obj.installedAt,
          installedByName: installer?.name ?? installer?.username ?? undefined,
          conditionAtInstallation: obj.conditionAtInstallation,
          deinstalledAt: obj.deinstalledAt,
          deinstalledByName:
            deinstaller?.name ?? deinstaller?.username ?? undefined,
          conditionAtDeinstallation: obj.conditionAtDeinstallation,
          returnedAt: obj.returnedAt,
        };
      }),
    );

    return results;
  },
});

/**
 * Bulk install all pending objects in an exhibition
 */
export const bulkInstallObjects = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    installedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    const pendingObjects = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const obj of pendingObjects) {
      const newLocationId = obj.exhibitionLocationId ?? exhibition.locationId;

      await ctx.db.patch(obj._id, {
        status: "installed",
        installedAt: Date.now(),
        installedBy: userId,
      });

      if (newLocationId) {
        await ctx.db.patch(obj.collectionId, {
          currentLocationId: newLocationId,
        });
      }
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "bulk_installed_exhibition_objects",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { count: pendingObjects.length },
    });

    return { installedCount: pendingObjects.length };
  },
});

/**
 * Bulk return all deinstalled objects in an exhibition
 */
export const bulkReturnObjects = mutation({
  args: {
    exhibitionId: v.id("exhibitions"),
  },
  returns: v.object({
    returnedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const exhibition = await ctx.db.get(args.exhibitionId);
    if (!exhibition) {
      throw new Error("Exhibition not found");
    }

    await requireExhibitionAccess(ctx, exhibition.organizationId);
    await requirePermission(
      ctx,
      exhibition.organizationId,
      "collections.update",
    );

    const deinstalledObjects = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("status"), "deinstalled"))
      .collect();

    for (const obj of deinstalledObjects) {
      if (obj.originalLocationId) {
        await ctx.db.patch(obj.collectionId, {
          currentLocationId: obj.originalLocationId,
        });
      }

      await ctx.db.patch(obj._id, {
        status: "returned",
        returnedToOriginalLocation: true,
        returnedAt: Date.now(),
      });
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "bulk_returned_exhibition_objects",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { count: deinstalledObjects.length },
    });

    return { returnedCount: deinstalledObjects.length };
  },
});
