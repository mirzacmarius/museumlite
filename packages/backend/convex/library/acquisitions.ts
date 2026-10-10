import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { query } from "../_generated/server";
import {
  readWorkflowHistoryPage,
  workflowHistoryPageValidator,
} from "../auditLog";
import { appendCaseHistory } from "../utils/caseHistory";
import { mutation } from "../utils/mutationBuilders";
import { dispatchNotification } from "../utils/notificationDispatch";
import {
  canApproveAtStep,
  canInitiateWorkflow,
  getUsersToNotifyForWorkflowStep,
} from "../utils/permissions";
import { getWorkflowConfig } from "../utils/workflowConfigs";
import { resolveWorkflowStepState } from "../utils/workflowSteps";
import { requireLibraryPermission } from "./utils/permissions";

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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requireLibraryPermission(ctx, args.organizationId, "collections.create"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    const workflowConfig = await getWorkflowConfig(
      ctx,
      args.organizationId,
      "acquisition",
    );
    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      undefined,
    );

    if (workflowConfig && workflowState.firstStep === undefined) {
      throw new Error("Workflow has no approval steps configured");
    }

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
      workflowStep: workflowConfig ? (workflowState.firstStep ?? 1) : undefined,
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
        workflowState.firstStep ?? 1,
      );

      await dispatchNotification(ctx, {
        organizationId: args.organizationId,
        type: "workflow_pending",
        recipients: usersToNotify.filter((approverId) => approverId !== userId),
        title: "Acquisition Request Requires Approval",
        message: `Acquisition request for "${args.title}" is pending your approval at step ${workflowState.firstStep ?? 1}.`,
        related: {
          entityType: "libraryAcquisitionRequest",
          entityId: requestId,
        },
      });
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
    await Promise.all([
      requireLibraryPermission(ctx, args.organizationId, "collections.read"),
    ]);

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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    await Promise.all([
      requireLibraryPermission(
        ctx,
        request.organizationId,
        "collections.update",
      ),
    ]);

    const validTransitions: Record<string, string[]> = {
      approved: ["ordered", "cancelled"],
      ordered: ["received", "cancelled"],
      received: ["cataloged"],
    };

    const allowed = validTransitions[request.status];
    if (!allowed?.includes(args.status)) {
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

    await Promise.all([
      ctx.db.patch(args.requestId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "status_changed",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: { from: request.status, to: args.status },
      }),
    ]);

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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (!["approved", "ordered"].includes(request.status)) {
      throw new Error(
        "Can only update order info for approved or ordered requests",
      );
    }

    await Promise.all([
      requireLibraryPermission(
        ctx,
        request.organizationId,
        "collections.update",
      ),
    ]);

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

    await Promise.all([
      ctx.db.patch(args.requestId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "updated",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: updates,
      }),
    ]);

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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "received") {
      throw new Error("Can only link items to received requests");
    }

    await Promise.all([
      requireLibraryPermission(
        ctx,
        request.organizationId,
        "collections.update",
      ),
    ]);

    await Promise.all([
      ctx.db.patch(args.requestId, {
        libraryItemId: args.libraryItemId,
        status: "cataloged",
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "linked_to_item",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: { libraryItemId: args.libraryItemId, status: "cataloged" },
      }),
    ]);

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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Cannot update request in current status");
    }

    await Promise.all([
      requireLibraryPermission(
        ctx,
        request.organizationId,
        "collections.update",
      ),
    ]);

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

    await Promise.all([
      ctx.db.patch(args.requestId, updates),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "updated",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: updates,
      }),
    ]);

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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (["received", "cataloged"].includes(request.status)) {
      throw new Error("Cannot cancel request that has been received");
    }

    await Promise.all([
      requireLibraryPermission(
        ctx,
        request.organizationId,
        "collections.update",
      ),
    ]);

    await Promise.all([
      ctx.db.patch(args.requestId, { status: "cancelled" }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "cancelled",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: { status: "cancelled" },
      }),
    ]);

    return null;
  },
});

export const remove = mutation({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (!["submitted", "rejected", "cancelled"].includes(request.status)) {
      throw new Error("Cannot delete request in current status");
    }

    await Promise.all([
      requireLibraryPermission(
        ctx,
        request.organizationId,
        "collections.delete",
      ),
    ]);

    await Promise.all([
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "deleted",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: { title: request.title },
      }),
      ctx.db.delete(args.requestId),
    ]);

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
    await Promise.all([
      requireLibraryPermission(ctx, args.organizationId, "collections.read"),
    ]);
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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Request is not pending approval");
    }

    await requireLibraryPermission(
      ctx,
      request.organizationId,
      "collections.update",
    );

    const workflowConfig = await getWorkflowConfig(
      ctx,
      request.organizationId,
      "acquisition",
    );

    const now = Date.now();

    if (workflowConfig) {
      const workflowState = resolveWorkflowStepState(
        workflowConfig.steps,
        request.workflowStep,
      );
      const currentStep = workflowState.currentStep;

      if (currentStep === undefined) {
        throw new Error("Workflow has no approval steps configured");
      }
      if (!workflowState.hasCurrentStep && !workflowState.isPastLastStep) {
        throw new Error("Current workflow step is not configured");
      }

      const canApprove = await canApproveAtStep(
        ctx,
        request.organizationId,
        "acquisition",
        currentStep,
      );

      if (!canApprove) {
        throw new Error("Permission denied: cannot approve at this step");
      }

      const history = [...(request.workflowHistory ?? [])];
      if (!workflowState.isPastLastStep) {
        history.push({
          step: currentStep,
          approvedBy: userId,
          approvedAt: now,
          comment: args.comment,
        });
      }

      const isLastStep =
        workflowState.isPastLastStep || workflowState.isLastStep;

      if (isLastStep) {
        await Promise.all([
          ctx.db.patch(args.requestId, {
            status: "approved",
            reviewedBy: userId,
            reviewedAt: now,
            reviewNotes: args.comment,
            ...(await appendCaseHistory(ctx, request, "acquisition", history)),
          }),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: request.organizationId,
            userId,
            action: "approved",
            entityType: "libraryAcquisitionRequest",
            entityId: args.requestId,
            changes: { status: "approved", step: currentStep },
          }),
        ]);

        const creatorEntry = history.find((h) => h.step === 0);
        const creatorId = creatorEntry?.approvedBy;
        if (creatorId && creatorId !== userId) {
          await dispatchNotification(ctx, {
            organizationId: request.organizationId,
            type: "workflow_approved",
            recipients: [creatorId],
            title: "Acquisition Request Approved",
            message: `Acquisition request for "${request.title}" has been approved.`,
            related: {
              entityType: "libraryAcquisitionRequest",
              entityId: args.requestId,
            },
          });
        }
      } else {
        const nextStep = workflowState.nextStep;
        if (nextStep === undefined) {
          throw new Error("Next workflow step is not configured");
        }
        const [, usersToNotify] = await Promise.all([
          Promise.all([
            ctx.db.patch(args.requestId, {
              status: "under_review",
              workflowStep: nextStep,
              ...(await appendCaseHistory(
                ctx,
                request,
                "acquisition",
                history,
              )),
            }),
            ctx.runMutation(internal.audit.logAction, {
              organizationId: request.organizationId,
              userId,
              action: "step_approved",
              entityType: "libraryAcquisitionRequest",
              entityId: args.requestId,
              changes: { step: currentStep, nextStep },
            }),
          ]),
          getUsersToNotifyForWorkflowStep(
            ctx,
            request.organizationId,
            "acquisition",
            nextStep,
          ),
        ] as const);

        await dispatchNotification(ctx, {
          organizationId: request.organizationId,
          type: "workflow_pending",
          recipients: usersToNotify.filter(
            (approverId) => approverId !== userId,
          ),
          title: "Acquisition Request Requires Your Approval",
          message: `Acquisition request for "${request.title}" is pending your approval at step ${nextStep}.`,
          related: {
            entityType: "libraryAcquisitionRequest",
            entityId: args.requestId,
          },
        });
      }
    } else {
      await Promise.all([
        ctx.db.patch(args.requestId, {
          status: "approved",
          reviewedBy: userId,
          reviewedAt: now,
          reviewNotes: args.comment,
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: request.organizationId,
          userId,
          action: "approved",
          entityType: "libraryAcquisitionRequest",
          entityId: args.requestId,
          changes: { status: "approved" },
        }),
      ]);
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
    const [userId, request] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.requestId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!request) {
      throw new Error("Request not found");
    }

    if (!["submitted", "under_review"].includes(request.status)) {
      throw new Error("Request is not pending approval");
    }

    await requireLibraryPermission(
      ctx,
      request.organizationId,
      "collections.update",
    );

    const workflowConfig = await getWorkflowConfig(
      ctx,
      request.organizationId,
      "acquisition",
    );
    const workflowState = resolveWorkflowStepState(
      workflowConfig?.steps,
      request.workflowStep,
    );
    const currentStep = workflowState.currentStep ?? request.workflowStep ?? 1;
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
    const history = [...(request.workflowHistory ?? [])];
    history.push({
      step: currentStep,
      approvedBy: userId,
      approvedAt: now,
      comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
    });

    await Promise.all([
      ctx.db.patch(args.requestId, {
        status: "rejected",
        reviewedBy: userId,
        reviewedAt: now,
        reviewNotes: args.comment,
        ...(await appendCaseHistory(ctx, request, "acquisition", history)),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: request.organizationId,
        userId,
        action: "rejected",
        entityType: "libraryAcquisitionRequest",
        entityId: args.requestId,
        changes: { status: "rejected", comment: args.comment },
      }),
    ]);

    const creatorEntry = history.find((h) => h.step === 0);
    const creatorId = creatorEntry?.approvedBy ?? request.requestedBy;
    if (creatorId && creatorId !== userId) {
      await dispatchNotification(ctx, {
        organizationId: request.organizationId,
        type: "workflow_rejected",
        recipients: [creatorId],
        title: "Acquisition Request Rejected",
        message: `Acquisition request for "${request.title}" has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
        related: {
          entityType: "libraryAcquisitionRequest",
          entityId: args.requestId,
        },
      });
    }

    return null;
  },
});

export const getWorkflowHistory = query({
  args: {
    requestId: v.id("libraryAcquisitionRequests"),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: workflowHistoryPageValidator,
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Request not found");
    }

    await requireLibraryPermission(
      ctx,
      request.organizationId,
      "collections.read",
    );

    return await readWorkflowHistoryPage(ctx, {
      organizationId: request.organizationId,
      caseType: "acquisition",
      entityId: args.requestId,
      cursor: args.cursor,
      limit: args.limit,
    });
  },
});
