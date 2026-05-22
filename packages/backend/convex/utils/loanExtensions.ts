import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getUsersToNotifyForWorkflowStep,
  requirePermission,
} from "./permissions";

export async function requestLoanExtensionHandler(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    newEndDate: number;
    reason?: string;
  },
) {
  const [userId, loan] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.loanId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!loan) {
    throw new Error("Loan not found");
  }

  // Can only extend active or dispatched loans
  if (loan.status !== "active" && loan.status !== "dispatched") {
    throw new Error(
      "Can only request extension for active or dispatched loans",
    );
  }

  // New end date must be after current end date
  if (loan.endDate && args.newEndDate <= loan.endDate) {
    throw new Error("New end date must be after current end date");
  }

  // Verify permission
  const [, existingRequest] = await Promise.all([
    requirePermission(ctx, loan.organizationId, "loans.update"),
    ctx.db
      .query("loanExtensionRequests")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first(),
  ] as const);

  if (existingRequest) {
    throw new Error("An extension request is already pending for this loan");
  }

  const [requestId, approvers] = await Promise.all([
    ctx.db.insert("loanExtensionRequests", {
      loanId: args.loanId,
      organizationId: loan.organizationId,
      requestedBy: userId,
      requestedAt: Date.now(),
      originalEndDate: loan.endDate ?? Date.now(),
      newRequestedEndDate: args.newEndDate,
      reason: args.reason,
      status: "pending",
    }),
    getUsersToNotifyForWorkflowStep(ctx, loan.organizationId, "loan", 1),
  ] as const);

  await Promise.all([
    ...Array.from(approvers).map((approverId) =>
      ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId: loan.organizationId,
        userId: approverId,
        type: "loan_extension_requested",
        title: "Loan Extension Requested",
        message: `Extension requested for loan ${loan.loanNumber}`,
        relatedEntityType: "loan",
        relatedEntityId: args.loanId,
      }),
    ),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "extension_requested",
      entityType: "loan",
      entityId: args.loanId,
      changes: {
        originalEndDate: loan.endDate,
        newRequestedEndDate: args.newEndDate,
        reason: args.reason,
      },
    }),
  ]);

  return requestId;
}

export async function approveLoanExtensionHandler(
  ctx: MutationCtx,
  args: {
    requestId: Id<"loanExtensionRequests">;
    comment?: string;
  },
) {
  const [userId, request] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.requestId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!request) {
    throw new Error("Extension request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Extension request is not pending");
  }

  // Verify permission
  await requirePermission(ctx, request.organizationId, "loans.approve");

  const loan = await ctx.db.get(request.loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }
  await Promise.all([
    ctx.db.patch(args.requestId, {
      status: "approved",
      approvedBy: userId,
      approvedAt: Date.now(),
      approvalComment: args.comment,
    }),
    ctx.db.patch(request.loanId, {
      endDate: request.newRequestedEndDate,
    }),
    ctx.runMutation(internal.audit.createNotificationInternal, {
      organizationId: request.organizationId,
      userId: request.requestedBy,
      type: "loan_extension_approved",
      title: "Loan Extension Approved",
      message: `Extension approved for loan ${loan.loanNumber}`,
      relatedEntityType: "loan",
      relatedEntityId: request.loanId,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "extension_approved",
      entityType: "loan",
      entityId: request.loanId,
      changes: {
        previousEndDate: request.originalEndDate,
        newEndDate: request.newRequestedEndDate,
      },
    }),
  ] as const);

  return null;
}

export async function rejectLoanExtensionHandler(
  ctx: MutationCtx,
  args: {
    requestId: Id<"loanExtensionRequests">;
    reason: string;
  },
) {
  const [userId, request] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.requestId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!request) {
    throw new Error("Extension request not found");
  }

  if (request.status !== "pending") {
    throw new Error("Extension request is not pending");
  }

  // Verify permission
  await requirePermission(ctx, request.organizationId, "loans.approve");

  const loan = await ctx.db.get(request.loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }
  await Promise.all([
    ctx.db.patch(args.requestId, {
      status: "rejected",
      rejectionReason: args.reason,
    }),
    ctx.runMutation(internal.audit.createNotificationInternal, {
      organizationId: request.organizationId,
      userId: request.requestedBy,
      type: "loan_extension_rejected",
      title: "Loan Extension Rejected",
      message: `Extension rejected for loan ${loan.loanNumber}: ${args.reason}`,
      relatedEntityType: "loan",
      relatedEntityId: request.loanId,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: request.organizationId,
      userId,
      action: "extension_rejected",
      entityType: "loan",
      entityId: request.loanId,
      changes: { rejectionReason: args.reason },
    }),
  ] as const);

  return null;
}

export async function listLoanExtensionRequestsHandler(
  ctx: QueryCtx,
  args: { loanId: Id<"loans"> },
) {
  const loan = await ctx.db.get(args.loanId);
  if (!loan) {
    return [];
  }

  const [, requests] = await Promise.all([
    requirePermission(ctx, loan.organizationId, "loans.read"),
    ctx.db
      .query("loanExtensionRequests")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect(),
  ] as const);

  // Enrich with user names
  return await Promise.all(
    requests.map(async (request) => {
      const requester = await ctx.db.get(request.requestedBy);
      const approver = request.approvedBy
        ? await ctx.db.get(request.approvedBy)
        : null;

      return {
        ...request,
        requestedByName: requester?.name ?? requester?.email,
        approvedByName: approver?.name ?? approver?.email,
      };
    }),
  );
}
