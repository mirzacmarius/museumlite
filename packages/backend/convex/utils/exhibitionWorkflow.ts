import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { readWorkflowHistoryPage } from "../auditLog";
import { appendCaseHistory } from "./caseHistory";
import { requireExhibitionAccess } from "./exhibitionAccess";
import {
  requireExhibitionReadPermission,
  requireExhibitionUpdatePermission,
} from "./exhibitionContext";
import { getExhibitionsForObject } from "./exhibitionParticipation";
import { isExhibitionObjectOutcomeResolved } from "./exhibitionPhysicalHandoff";
import { assertCollectionNotOnLoan } from "./loanOccupancy";
import {
  canApproveAtStep,
  getUsersToNotifyForWorkflowStep,
  requirePermission,
} from "./permissions";
import { getWorkflowConfig } from "./workflowConfigs";
import { resolveWorkflowStepState } from "./workflowSteps";

export async function approveExhibitionHandler(
  ctx: MutationCtx,
  args: { exhibitionId: Id<"exhibitions">; comment?: string },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "proposed") {
    throw new Error("Exhibition is not pending approval");
  }

  await requireExhibitionAccess(ctx, exhibition.organizationId);

  const workflowConfig = await getWorkflowConfig(
    ctx,
    exhibition.organizationId,
    "exhibition",
  );

  if (workflowConfig) {
    const workflowState = resolveWorkflowStepState(
      workflowConfig.steps,
      exhibition.workflowStep,
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
      exhibition.organizationId,
      "exhibition",
      currentStep,
    );

    if (!canApprove) {
      throw new Error("Permission denied: cannot approve at this step");
    }

    const history = [...(exhibition.workflowHistory ?? [])];
    if (!workflowState.isPastLastStep) {
      history.push({
        step: currentStep,
        approvedBy: userId,
        approvedAt: Date.now(),
        comment: args.comment,
      });
    }

    const isLastStep = workflowState.isPastLastStep || workflowState.isLastStep;

    if (isLastStep) {
      await Promise.all([
        ctx.db.patch(args.exhibitionId, {
          status: "approved",
          approvedBy: userId,
          approvedAt: Date.now(),
          ...(await appendCaseHistory(ctx, exhibition, "exhibition", history)),
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: exhibition.organizationId,
          userId,
          action: "approved",
          entityType: "exhibition",
          entityId: args.exhibitionId,
          changes: { status: "approved", step: currentStep },
        }),
      ]);

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
      const nextStep = workflowState.nextStep;
      if (nextStep === undefined) {
        throw new Error("Next workflow step is not configured");
      }
      const [, usersToNotify] = await Promise.all([
        Promise.all([
          ctx.db.patch(args.exhibitionId, {
            workflowStep: nextStep,
            ...(await appendCaseHistory(
              ctx,
              exhibition,
              "exhibition",
              history,
            )),
          }),
          ctx.runMutation(internal.audit.logAction, {
            organizationId: exhibition.organizationId,
            userId,
            action: "step_approved",
            entityType: "exhibition",
            entityId: args.exhibitionId,
            changes: { step: currentStep, nextStep },
          }),
        ]),
        getUsersToNotifyForWorkflowStep(
          ctx,
          exhibition.organizationId,
          "exhibition",
          nextStep,
        ),
      ] as const);

      await Promise.all(
        Array.from(usersToNotify).map(async (approverId) => {
          if (approverId !== userId) {
            await ctx.runMutation(internal.audit.createNotificationInternal, {
              organizationId: exhibition.organizationId,
              userId: approverId,
              type: "workflow_pending",
              title: "Exhibition Requires Your Approval",
              message: `Exhibition "${exhibition.title}" is pending your approval at step ${nextStep}.`,
              relatedEntityType: "exhibition",
              relatedEntityId: args.exhibitionId,
            });
          }
        }),
      );
    }
  } else {
    await Promise.all([
      requirePermission(ctx, exhibition.organizationId, "collections.update"),
      ctx.db.patch(args.exhibitionId, {
        status: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: exhibition.organizationId,
        userId,
        action: "approved",
        entityType: "exhibition",
        entityId: args.exhibitionId,
        changes: { status: "approved" },
      }),
    ] as const);
  }

  return null;
}

export async function rejectExhibitionHandler(
  ctx: MutationCtx,
  args: { exhibitionId: Id<"exhibitions">; comment?: string },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "proposed") {
    throw new Error("Exhibition is not pending approval");
  }

  await requireExhibitionAccess(ctx, exhibition.organizationId);

  const workflowConfig = await getWorkflowConfig(
    ctx,
    exhibition.organizationId,
    "exhibition",
  );
  const workflowState = resolveWorkflowStepState(
    workflowConfig?.steps,
    exhibition.workflowStep,
  );
  const currentStep = workflowState.currentStep ?? exhibition.workflowStep ?? 1;
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

  const history = [...(exhibition.workflowHistory ?? [])];
  history.push({
    step: currentStep,
    approvedBy: userId,
    approvedAt: Date.now(),
    comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
  });

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      status: "rejected",
      ...(await appendCaseHistory(ctx, exhibition, "exhibition", history)),
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "rejected",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: { status: "rejected", comment: args.comment },
    }),
  ]);

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
}

export async function activateExhibitionHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    skipInstallationCheck?: boolean;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "approved") {
    throw new Error("Exhibition must be approved before activation");
  }

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

  const [, exhibitionObjects] = await Promise.all([
    requireExhibitionUpdatePermission(ctx, exhibition.organizationId),
    ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .collect(),
  ] as const);

  for (const obj of exhibitionObjects) {
    const collection = await ctx.db.get(obj.collectionId);
    if (collection) {
      await assertCollectionNotOnLoan(
        ctx,
        obj.collectionId,
        `Cannot activate exhibition: object "${collection.title}" is currently on loan`,
      );
    }
  }

  const notInstalled = exhibitionObjects.filter(
    (obj) => obj.status !== "installed",
  );
  if (notInstalled.length > 0) {
    throw new Error(
      `Cannot activate exhibition: ${notInstalled.length} object(s) are not installed`,
    );
  }

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      status: "active",
      isCurrent: true,
      activatedAt: Date.now(),
      activatedBy: userId,
      installationCompletedAt: exhibition.installationCompletedAt ?? Date.now(),
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "activated",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: {
        status: "active",
        participantCount: exhibitionObjects.length,
      },
    }),
  ] as const);

  return null;
}

export async function closeExhibitionHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    skipDeinstallationCheck?: boolean;
    returnObjectsToOriginalLocations?: boolean;
  },
) {
  const [userId, exhibition] = await Promise.all([
    getAuthUserId(ctx),
    ctx.db.get(args.exhibitionId),
  ] as const);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  if (exhibition.status !== "active" && exhibition.status !== "deinstalling") {
    throw new Error("Exhibition must be active or deinstalling to close");
  }

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

  const [, exhibitionObjects] = await Promise.all([
    requireExhibitionUpdatePermission(ctx, exhibition.organizationId),
    ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .collect(),
  ] as const);

  const outstandingObjects = exhibitionObjects.filter(
    (obj) => !isExhibitionObjectOutcomeResolved(obj),
  );

  if (args.returnObjectsToOriginalLocations === true) {
    throw new Error(
      "Automatic returns on close are disabled; record each return or authorize an exception",
    );
  }

  if (outstandingObjects.length > 0) {
    throw new Error(
      `Cannot close: ${outstandingObjects.length} object(s) have outstanding returns or exceptions`,
    );
  }

  await Promise.all([
    ctx.db.patch(args.exhibitionId, {
      status: "closed",
      isCurrent: false,
      endDate: Date.now(),
      deinstallationCompletedAt: Date.now(),
      closedAt: Date.now(),
      closedBy: userId,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "closed",
      entityType: "exhibition",
      entityId: args.exhibitionId,
      changes: {
        status: "closed",
        outstandingAtClose: outstandingObjects.length,
      },
    }),
  ]);

  return null;
}

export async function checkScheduleConflictsHandler(
  ctx: QueryCtx,
  args: {
    collectionId: Id<"collections">;
    startDate: number;
    endDate?: number;
    excludeExhibitionId?: Id<"exhibitions">;
  },
) {
  const collection = await ctx.db.get(args.collectionId);
  if (!collection) {
    return { hasConflicts: false, conflicts: [] };
  }

  await requireExhibitionReadPermission(ctx, collection.organizationId);

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

  const exhibitions = await getExhibitionsForObject(ctx, args.collectionId);

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
    .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
    .collect();

  await Promise.all(
    Array.from(loanItems).map(async (item) => {
      const loan = await ctx.db.get(item.loanId);
      if (!loan) return;

      if (loan.status === "cancelled" || loan.status === "returned") {
        return;
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
    }),
  );

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

type ScheduleConflictEntry = {
  type: "exhibition" | "loan";
  id: string;
  title: string;
  startDate: number;
  endDate?: number;
  status: string;
};

export async function checkScheduleConflictsForParticipantsHandler(
  ctx: QueryCtx,
  args: {
    collectionIds: Id<"collections">[];
    startDate: number;
    endDate?: number;
    excludeExhibitionId?: Id<"exhibitions">;
  },
) {
  const seen = new Set<string>();
  const conflicts: ScheduleConflictEntry[] = [];

  for (const collectionId of args.collectionIds) {
    const result = await checkScheduleConflictsHandler(ctx, {
      collectionId,
      startDate: args.startDate,
      endDate: args.endDate,
      excludeExhibitionId: args.excludeExhibitionId,
    });
    for (const conflict of result.conflicts) {
      const key = `${conflict.type}:${conflict.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push(conflict);
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
}

export async function getWorkflowHistoryHandler(
  ctx: QueryCtx,
  args: { exhibitionId: Id<"exhibitions">; cursor?: number; limit?: number },
) {
  const exhibition = await ctx.db.get(args.exhibitionId);
  if (!exhibition) {
    throw new Error("Exhibition not found");
  }

  await requireExhibitionReadPermission(ctx, exhibition.organizationId);

  return await readWorkflowHistoryPage(ctx, {
    organizationId: exhibition.organizationId,
    caseType: "exhibition",
    entityId: args.exhibitionId,
    cursor: args.cursor,
    limit: args.limit,
  });
}
