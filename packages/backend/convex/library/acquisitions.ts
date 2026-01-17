import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireModuleEnabled } from "../utils/featureGates";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
  requirePermission,
} from "../utils/permissions";

// Priority validator
const priorityValidator = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent"),
);

// Request status validator
const requestStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("approved"),
  v.literal("ordered"),
  v.literal("received"),
  v.literal("cataloged"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

/**
 * Create a new acquisition request
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.string(),
    authors: v.optional(v.array(v.string())),
    isbn: v.optional(v.string()),
    publisher: v.optional(v.string()),
    itemType: v.optional(v.string()),
    reason: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    quantity: v.optional(v.number()),
    estimatedPrice: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    fundSource: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryAcquisitionRequests"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireModuleEnabled(ctx, args.organizationId, "library");
    await requirePermission(ctx, args.organizationId, "collections.create");

    const canInitiate = await canInitiateWorkflow(
      ctx,
      args.organizationId,
      "acquisition",
    );
    if (!canInitiate) {
      throw new Error(
        "Permission denied: cannot initiate acquisition workflow",
      );
    }

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "acquisition"))
      .first();

    const now = Date.now();
    const workflowHistory = workflowConfig
      ? [
          {
            step: 0,
            approvedBy: userId,
            approvedAt: now,
            comment: "Created",
          },
        ]
      : [];

    const requestId = await ctx.db.insert("libraryAcquisitionRequests", {
      organizationId: args.organizationId,
      title: args.title,
      authors: args.authors,
      isbn: args.isbn,
      publisher: args.publisher,
      itemType: args.itemType,
      requestedBy: userId,
      requestedAt: now,
      reason: args.reason,
      priority: args.priority ?? "normal",
      quantity: args.quantity ?? 1,
      estimatedPrice: args.estimatedPrice,
      vendorId: args.vendorId,
      fundSource: args.fundSource,
      status: "submitted",
      workflowStep: workflowConfig ? 1 : undefined,
      workflowHistory: workflowHistory.length > 0 ? workflowHistory : undefined,
      notes: args.notes,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created",
      entityType: "libraryAcquisitionRequest",
      entityId: requestId,
      changes: { title: args.title, status: "submitted" },
    });

    if (workflowConfig) {
      const usersToNotify = await getUsersToNotifyForWorkflowStep(
        ctx,
        args.organizationId,
        "acquisition",
        1,
      );

      for (const approverId of usersToNotify) {
        if (approverId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: args.organizationId,
            userId: approverId,
            type: "workflow_pending",
            title: "Acquisition Request Requires Approval",
            message: `Acquisition request for "${args.title}" is pending your approval at step 1.`,
            relatedEntityType: "libraryAcquisitionRequest",
            relatedEntityId: requestId,
          });
        }
      }
    }

    return requestId;
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(requestStatusValidator),
    priority: v.optional(priorityValidator),
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    await requirePermission(ctx, args.organizationId, "collections.read");

    const requestQuery = args.status
      ? ctx.db
          .query("libraryAcquisitionRequests")
          .withIndex("by_organization_and_status", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("status", args.status!),
          )
      : ctx.db
          .query("libraryAcquisitionRequests")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );

    const requests = await requestQuery.paginate(args.paginationOpts);

    let filteredPage = requests.page;
    if (args.priority) {
      filteredPage = requests.page.filter((r) => r.priority === args.priority);
    }

    const enrichedPage = await Promise.all(
      filteredPage.map(async (request) => {
        const requestedBy = await ctx.db.get(request.requestedBy);
        const vendor = request.vendorId
          ? await ctx.db.get(request.vendorId)
          : null;
        return {
          ...request,
          requestedByUser: requestedBy,
          vendor,
        };
      }),
    );

    return {
      ...requests,
      page: enrichedPage,
    };
  },
});

export const updateStatus = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    status: v.union(
      v.literal("ordered"),
      v.literal("received"),
      v.literal("cataloged"),
      v.literal("cancelled"),
    ),
    reviewNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    await requirePermission(ctx, request.organizationId, "collections.update");

    const validTransitions: Record<string, string[]> = {
      approved: ["ordered", "cancelled"],
      ordered: ["received", "cancelled"],
      received: ["cataloged"],
    };

    const allowed = validTransitions[request.status];
    if (!allowed || !allowed.includes(args.status)) {
      throw new Error(
        `Invalid status transition from ${request.status} to ${args.status}`,
      );
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.status === "received") {
      updates.receivedDate = now;
    }

    await ctx.db.patch(args.requestId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "status_changed",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: { from: request.status, to: args.status },
    });

    return null;
  },
});

/**
 * Update order information
 */
export const updateOrderInfo = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    orderNumber: v.optional(v.string()),
    orderDate: v.optional(v.number()),
    expectedDelivery: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    actualPrice: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    await requirePermission(ctx, request.organizationId, "collections.update");

    if (!["approved", "ordered"].includes(request.status)) {
      throw new Error(
        "Can only update order info for approved or ordered requests",
      );
    }

    const updates: Record<string, unknown> = {};

    if (args.orderNumber !== undefined) updates.orderNumber = args.orderNumber;
    if (args.orderDate !== undefined) updates.orderDate = args.orderDate;
    if (args.expectedDelivery !== undefined)
      updates.expectedDelivery = args.expectedDelivery;
    if (args.vendorId !== undefined) updates.vendorId = args.vendorId;
    if (args.actualPrice !== undefined) updates.actualPrice = args.actualPrice;

    if (args.orderNumber && request.status === "approved") {
      updates.status = "ordered";
    }

    await ctx.db.patch(args.requestId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "updated",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: updates,
    });

    return null;
  },
});

/**
 * Link to created library item
 */
export const linkToItem = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    libraryItemId: v.id("libraryItems"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    await requirePermission(ctx, request.organizationId, "collections.update");

    if (request.status !== "received") {
      throw new Error("Can only link items to received requests");
    }

    await ctx.db.patch(args.requestId, {
      libraryItemId: args.libraryItemId,
      status: "cataloged",
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "linked_to_item",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: { libraryItemId: args.libraryItemId, status: "cataloged" },
    });

    return null;
  },
});

/**
 * Update a request
 */
export const update = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    title: v.optional(v.string()),
    authors: v.optional(v.array(v.string())),
    isbn: v.optional(v.string()),
    publisher: v.optional(v.string()),
    itemType: v.optional(v.string()),
    reason: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    quantity: v.optional(v.number()),
    estimatedPrice: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    fundSource: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    await requirePermission(ctx, request.organizationId, "collections.update");

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Cannot update request in current status");
    }

    const updates: Record<string, unknown> = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.authors !== undefined) updates.authors = args.authors;
    if (args.isbn !== undefined) updates.isbn = args.isbn;
    if (args.publisher !== undefined) updates.publisher = args.publisher;
    if (args.itemType !== undefined) updates.itemType = args.itemType;
    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.estimatedPrice !== undefined)
      updates.estimatedPrice = args.estimatedPrice;
    if (args.vendorId !== undefined) updates.vendorId = args.vendorId;
    if (args.fundSource !== undefined) updates.fundSource = args.fundSource;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.requestId, updates);

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "updated",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: updates,
    });

    return null;
  },
});

/**
 * Cancel a request
 */
export const cancel = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    await requirePermission(ctx, request.organizationId, "collections.update");

    if (["received", "cataloged"].includes(request.status)) {
      throw new Error("Cannot cancel request that has been received");
    }

    await ctx.db.patch(args.requestId, { status: "cancelled" });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "cancelled",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: { status: "cancelled" },
    });

    return null;
  },
});

export const remove = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    await requirePermission(ctx, request.organizationId, "collections.delete");

    if (!["submitted", "rejected", "cancelled"].includes(request.status)) {
      throw new Error("Cannot delete request in current status");
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "deleted",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: { title: request.title },
    });

    await ctx.db.delete(args.requestId);

    return null;
  },
});

/**
 * Get acquisition statistics
 */
export const getStatistics = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    total: v.number(),
    submitted: v.number(),
    underReview: v.number(),
    approved: v.number(),
    ordered: v.number(),
    received: v.number(),
    cataloged: v.number(),
    rejected: v.number(),
    totalSpent: v.number(),
    pendingBudget: v.number(),
    byPriority: v.object({
      urgent: v.number(),
      high: v.number(),
      normal: v.number(),
      low: v.number(),
    }),
    thisMonth: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireModuleEnabled(ctx, args.organizationId, "library");
    await requirePermission(ctx, args.organizationId, "collections.read");

    const requests = await ctx.db
      .query("libraryAcquisitionRequests")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const submitted = requests.filter((r) => r.status === "submitted").length;
    const underReview = requests.filter(
      (r) => r.status === "under_review",
    ).length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const ordered = requests.filter((r) => r.status === "ordered").length;
    const received = requests.filter((r) => r.status === "received").length;
    const cataloged = requests.filter((r) => r.status === "cataloged").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;

    const totalSpent = requests
      .filter(
        (r) => r.actualPrice && ["received", "cataloged"].includes(r.status),
      )
      .reduce((sum, r) => sum + (r.actualPrice || 0) * r.quantity, 0);

    const pendingBudget = requests
      .filter((r) =>
        ["submitted", "under_review", "approved", "ordered"].includes(r.status),
      )
      .reduce((sum, r) => sum + (r.estimatedPrice || 0) * r.quantity, 0);

    const byPriority = {
      urgent: requests.filter((r) => r.priority === "urgent").length,
      high: requests.filter((r) => r.priority === "high").length,
      normal: requests.filter((r) => r.priority === "normal").length,
      low: requests.filter((r) => r.priority === "low").length,
    };

    const now = Date.now();
    const thisMonth = new Date(now);
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const thisMonthStart = thisMonth.getTime();

    const thisMonthCount = requests.filter(
      (r) => r.requestedAt >= thisMonthStart,
    ).length;

    return {
      total: requests.length,
      submitted,
      underReview,
      approved,
      ordered,
      received,
      cataloged,
      rejected,
      totalSpent,
      pendingBudget,
      byPriority,
      thisMonth: thisMonthCount,
    };
  },
});

export const approve = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Request is not pending approval");
    }

    const workflowConfig = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", request.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), "acquisition"))
      .first();

    const now = Date.now();

    if (workflowConfig) {
      const currentStep = request.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        request.organizationId,
        "acquisition",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      const history = request.workflowHistory ?? [];
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: now,
        comment: args.comment,
      });

      const isLastStep = currentStep >= workflowConfig.steps.length;

      if (isLastStep) {
        await ctx.db.patch(args.requestId, {
          status: "approved",
          reviewedBy: userId,
          reviewedAt: now,
          reviewNotes: args.comment,
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: request.organizationId,
          userId,
          action: "approved",
          entityType: "libraryAcquisitionRequest",
          entityId: args.requestId,
          changes: { status: "approved", step: currentStep },
        });

        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await ctx.runMutation(internal.audit.createNotificationInternal, {
            organizationId: request.organizationId,
            userId: creatorId,
            type: "workflow_approved",
            title: "Acquisition Request Approved",
            message: `Acquisition request for "${request.title}" has been approved.`,
            relatedEntityType: "libraryAcquisitionRequest",
            relatedEntityId: args.requestId,
          });
        }
      } else {
        await ctx.db.patch(args.requestId, {
          status: "under_review",
          workflowStep: currentStep + 1,
          workflowHistory: history,
        });

        await ctx.runMutation(internal.audit.logAction, {
          organizationId: request.organizationId,
          userId,
          action: "step_approved",
          entityType: "libraryAcquisitionRequest",
          entityId: args.requestId,
          changes: { step: currentStep, nextStep: currentStep + 1 },
        });

        const usersToNotify = await getUsersToNotifyForWorkflowStep(
          ctx,
          request.organizationId,
          "acquisition",
          currentStep + 1,
        );

        for (const approverId of usersToNotify) {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: request.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Acquisition Request Requires Your Approval",
              message: `Acquisition request for "${request.title}" is pending your approval at step ${currentStep + 1}.`,
              relatedEntityType: "libraryAcquisitionRequest",
              relatedEntityId: args.requestId,
            });
          }
        }
      }
    } else {
      await ctx.db.patch(args.requestId, {
        status: "approved",
        reviewedBy: userId,
        reviewedAt: now,
        reviewNotes: args.comment,
      });

      await ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "approved",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: { status: "approved" },
      });
    }

    return null;
  },
});

export const reject = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    comment: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Request is not pending approval");
    }

    const currentStep = request.workflowStep ?? 1;
    const canApprove = await canApproveAtStep(
      ctx,
      request.organizationId,
      "acquisition",
      currentStep,
    );

    if (!canApprove) {
      throw new Error("Permission denied: cannot reject at this step");
    }

    const now = Date.now();
    const history = request.workflowHistory ?? [];
    history.push({
      step: currentStep,
      approvedBy: userId,
      approvedAt: now,
      comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
    });

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: now,
      reviewNotes: args.comment,
      workflowHistory: history,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "rejected",
      entityType: "libraryAcquisitionRequest",
      entityId: args.requestId,
      changes: { status: "rejected", comment: args.comment },
    });

    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy ?? request.requestedBy;
    if (creatorId && creatorId !== userId) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: request.organizationId,
        userId: creatorId,
        type: "workflow_rejected",
        title: "Acquisition Request Rejected",
        message: `Acquisition request for "${request.title}" has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        relatedEntityType: "libraryAcquisitionRequest",
        relatedEntityId: args.requestId,
      });
    }

    return null;
  },
});

export const getWorkflowHistory = query({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
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
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireModuleEnabled(ctx, request.organizationId, "library");

    const history = request.workflowHistory ?? [];

    const enrichedHistory = await Promise.all(
      history.map(async (item) => {
        const approver = await ctx.db.get(item.approvedBy);
        return {
          ...item,
          approverName: approver?.name || approver?.email || undefined,
        };
      }),
    );

    return enrichedHistory;
  },
});
