import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { markCollectionActive } from "./collectionLifecycle";
import { requireLoansAccess } from "./loanAccess";
import {
  ALLOWED_LOAN_TRANSITIONS,
  assertAllowedLoanTransition,
} from "./loanStatusTransitions";
import {
  getOrganizationNotificationRecipients,
  getWorkflowCreatorRecipient,
} from "./notificationRecipients";
import { canApproveAtStep, requirePermission } from "./permissions";
import { getWorkflowConfig } from "./workflowConfigs";
import {
  prepareWorkflowStepAdvance,
  recordWorkflowStepAdvance,
  recordWorkflowStepApproval,
} from "./workflowExecution";
import { resolveWorkflowStepState } from "./workflowSteps";

async function getLoanEmailItemData(
  ctx: MutationCtx,
  loanId: Id<"loans">,
): Promise<{ itemName: string; itemCount: number }> {
  const loanItems = await ctx.db
    .query("loanItems")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .collect();
  const firstItem = loanItems[0];
  const collection = firstItem
    ? await ctx.db.get(firstItem.collectionId)
    : null;

  return { itemName: collection?.title ?? "", itemCount: loanItems.length };
}

export async function approveLoanHandler(
  ctx: MutationCtx,
  args: { loanId: Id<"loans">; comment?: string },
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

  assertAllowedLoanTransition(loan.status, "active", "Loan is not pending");

  await Promise.all([
    requireLoansAccess(ctx, loan.organizationId),
    requirePermission(ctx, loan.organizationId, "loans.approve"),
  ]);

  const workflowConfig = await getWorkflowConfig(
    ctx,
    loan.organizationId,
    "loan",
  );

  if (workflowConfig) {
    const workflowState = resolveWorkflowStepState(
      workflowConfig.steps,
      loan.workflowStep,
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
      loan.organizationId,
      "loan",
      currentStep,
    );

    if (!canApprove) {
      throw new Error("Permission denied: cannot approve at this step");
    }

    const currentStepConfig = workflowConfig.steps.find(
      (step) => step.stepNumber === currentStep,
    );
    if (!currentStepConfig) {
      throw new Error("Current workflow step is not configured");
    }

    const { approvalDecision, approvalMode } = await recordWorkflowStepApproval(
      ctx,
      {
        organizationId: loan.organizationId,
        workflowType: "loan",
        entityId: args.loanId,
        stepNumber: currentStep,
        step: currentStepConfig,
        performedBy: userId,
        comment: args.comment,
        isPastLastStep: workflowState.isPastLastStep,
      },
    );

    if (!approvalDecision.shouldAdvance) {
      return null;
    }

    const history = loan.workflowHistory ?? [];
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
        ctx.db.patch(args.loanId, {
          status: "active",
          approvedBy: userId,
          approvedAt: Date.now(),
          workflowHistory: history,
        }),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: loan.organizationId,
          userId,
          action: "approved",
          entityType: "loan",
          entityId: args.loanId,
          changes: { status: "active", step: currentStep },
        }),
      ]);
      const { itemName, itemCount } = await getLoanEmailItemData(
        ctx,
        args.loanId,
      );

      // Build loan URL
      const siteUrl = process.env.SITE_URL;
      const loanUrl = siteUrl ? `${siteUrl}/loans/${args.loanId}` : undefined;

      const creatorId = getWorkflowCreatorRecipient(history, userId);
      if (creatorId && creatorId !== userId) {
        await ctx.runMutation(internal.notifications.sendNotification, {
          organizationId: loan.organizationId,
          userId: creatorId,
          type: "loan_approved",
          title: "Loan Approved",
          message: `Loan ${loan.loanNumber} has been fully approved and is now active.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
          emailData: {
            loanId: args.loanId,
            itemName,
            borrowerName: loan.lenderBorrowerName,
            startDate: loan.startDate,
            endDate: loan.endDate,
            itemCount,
            loanUrl,
          },
        });
      }
    } else {
      const nextStep = await prepareWorkflowStepAdvance(ctx, {
        organizationId: loan.organizationId,
        workflowType: "loan",
        fromStep: currentStep,
        toStep: workflowState.nextStep,
      });

      await ctx.db.patch(args.loanId, {
        workflowStep: nextStep,
        workflowHistory: history,
      });

      if (approvalMode !== "single") {
        await ctx.runMutation(internal.workflows.clearStepApprovals, {
          workflowType: "loan",
          entityId: args.loanId,
          stepNumber: currentStep,
        });
      }

      await recordWorkflowStepAdvance(ctx, {
        organizationId: loan.organizationId,
        workflowType: "loan",
        entityId: args.loanId,
        fromStep: currentStep,
        toStep: nextStep,
        performedBy: userId,
        notification: {
          title: "Loan Requires Your Approval",
          message: `Loan ${loan.loanNumber} is pending your approval at step ${nextStep}.`,
        },
      });
    }
  } else {
    await Promise.all([
      ctx.db.patch(args.loanId, {
        status: "active",
        approvedBy: userId,
        approvedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "approved",
        entityType: "loan",
        entityId: args.loanId,
        changes: { status: "active" },
      }),
    ]);
    const [recipients, loanItemData] = await Promise.all([
      getOrganizationNotificationRecipients(ctx, loan.organizationId, userId),
      getLoanEmailItemData(ctx, args.loanId),
    ] as const);
    const { itemName, itemCount } = loanItemData;

    // Build loan URL (this will be used in the email deep link)
    const siteUrl = process.env.SITE_URL;
    const loanUrl = siteUrl ? `${siteUrl}/loans/${args.loanId}` : undefined;

    await Promise.all(
      Array.from(recipients).map(async (recipientId) => {
        await ctx.runMutation(internal.notifications.sendNotification, {
          organizationId: loan.organizationId,
          userId: recipientId,
          type: "loan_approved",
          title: "Loan Approved",
          message: `Loan ${loan.loanNumber} has been approved and is now active.`,
          relatedEntityType: "loan",
          relatedEntityId: args.loanId,
          emailData: {
            loanId: args.loanId,
            itemName,
            borrowerName: loan.lenderBorrowerName,
            startDate: loan.startDate,
            endDate: loan.endDate,
            itemCount,
            loanUrl,
          },
        });
      }),
    );
  }

  return null;
}

export async function rejectLoanHandler(
  ctx: MutationCtx,
  args: { loanId: Id<"loans">; comment?: string },
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

  if (loan.status !== "pending") {
    throw new Error("Loan is not pending approval");
  }

  await requireLoansAccess(ctx, loan.organizationId);

  const workflowConfig = await getWorkflowConfig(
    ctx,
    loan.organizationId,
    "loan",
  );
  const workflowState = resolveWorkflowStepState(
    workflowConfig?.steps,
    loan.workflowStep,
  );
  const currentStep = workflowState.currentStep ?? loan.workflowStep ?? 1;
  const canApprove = await canApproveAtStep(
    ctx,
    loan.organizationId,
    "loan",
    currentStep,
  );

  if (!canApprove) {
    await requirePermission(ctx, loan.organizationId, "loans.approve");
  }

  const history = loan.workflowHistory ?? [];
  history.push({
    step: currentStep,
    approvedBy: userId,
    approvedAt: Date.now(),
    comment: args.comment ? `Rejected: ${args.comment}` : "Rejected",
  });
  assertAllowedLoanTransition(
    loan.status,
    "cancelled",
    "Loan is not pending approval",
  );
  await Promise.all([
    ctx.db.patch(args.loanId, {
      status: "cancelled",
      workflowHistory: history,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: loan.organizationId,
      userId,
      action: "rejected",
      entityType: "loan",
      entityId: args.loanId,
      changes: { status: "cancelled", comment: args.comment },
    }),
  ]);
  const { itemName, itemCount } = await getLoanEmailItemData(ctx, args.loanId);

  // Build loan URL
  const siteUrl = process.env.SITE_URL;
  const loanUrl = siteUrl ? `${siteUrl}/loans/${args.loanId}` : undefined;

  const creatorId = getWorkflowCreatorRecipient(history, userId);
  if (creatorId && creatorId !== userId) {
    await ctx.runMutation(internal.notifications.sendNotification, {
      organizationId: loan.organizationId,
      userId: creatorId,
      type: "loan_rejected",
      title: "Loan Rejected",
      message: `Loan ${loan.loanNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
      relatedEntityType: "loan",
      relatedEntityId: args.loanId,
      emailData: {
        loanId: args.loanId,
        itemName,
        borrowerName: loan.lenderBorrowerName,
        startDate: loan.startDate,
        endDate: loan.endDate,
        itemCount,
        loanUrl,
      },
    });
  }

  return null;
}

export async function getLoanWorkflowHistoryHandler(
  ctx: QueryCtx,
  args: { loanId: Id<"loans"> },
) {
  const loan = await ctx.db.get(args.loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  await requirePermission(ctx, loan.organizationId, "loans.read");

  const history = loan.workflowHistory ?? [];

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
}

export async function bulkApproveLoansHandler(
  ctx: MutationCtx,
  args: { loanIds: Array<Id<"loans">> },
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  if (args.loanIds.length === 0) {
    return { approved: 0, skipped: 0, errors: [] };
  }

  let approved = 0;
  let skipped = 0;
  const errors: string[] = [];

  await Promise.all(
    Array.from(args.loanIds).map(async (loanId) => {
      const loan = await ctx.db.get(loanId);
      if (!loan) {
        errors.push(`Loan ${loanId} not found`);
        skipped++;
        return;
      }

      // Check permission for each loan's organization
      try {
        await requirePermission(ctx, loan.organizationId, "loans.approve");
      } catch {
        errors.push(`No permission to approve loan ${loan.loanNumber}`);
        skipped++;
        return;
      }

      if (!ALLOWED_LOAN_TRANSITIONS[loan.status].includes("active")) {
        errors.push(
          `Loan ${loan.loanNumber} is not pending (status: ${loan.status})`,
        );
        skipped++;
        return;
      }

      // Check workflow config
      const workflowConfig = await getWorkflowConfig(
        ctx,
        loan.organizationId,
        "loan",
      );

      if (workflowConfig) {
        const workflowState = resolveWorkflowStepState(
          workflowConfig.steps,
          loan.workflowStep,
        );
        const currentStep = workflowState.currentStep;

        if (currentStep === undefined) {
          errors.push(
            `Loan ${loan.loanNumber} workflow has no approval steps configured`,
          );
          skipped++;
          return;
        }
        if (!workflowState.hasCurrentStep && !workflowState.isPastLastStep) {
          errors.push(
            `Loan ${loan.loanNumber} current workflow step is not configured`,
          );
          skipped++;
          return;
        }

        const canApprove = await canApproveAtStep(
          ctx,
          loan.organizationId,
          "loan",
          currentStep,
        );

        if (!canApprove) {
          errors.push(
            `Cannot approve loan ${loan.loanNumber} at current workflow step`,
          );
          skipped++;
          return;
        }

        const currentStepConfig = workflowConfig.steps.find(
          (step) => step.stepNumber === currentStep,
        );
        if (!currentStepConfig) {
          errors.push(
            `Loan ${loan.loanNumber} current workflow step is not configured`,
          );
          skipped++;
          return;
        }

        const { approvalDecision, approvalMode } =
          await recordWorkflowStepApproval(ctx, {
            organizationId: loan.organizationId,
            workflowType: "loan",
            entityId: loanId,
            stepNumber: currentStep,
            step: currentStepConfig,
            performedBy: userId,
            comment: "Bulk approved",
            isPastLastStep: workflowState.isPastLastStep,
          });

        if (!approvalDecision.shouldAdvance) {
          approved++;
          return;
        }

        const history = loan.workflowHistory ?? [];
        if (!workflowState.isPastLastStep) {
          history.push({
            step: currentStep,
            approvedBy: userId,
            approvedAt: Date.now(),
            comment: "Bulk approved",
          });
        }

        const isLastStep =
          workflowState.isPastLastStep || workflowState.isLastStep;

        if (isLastStep) {
          await ctx.db.patch(loanId, {
            status: "active",
            approvedBy: userId,
            approvedAt: Date.now(),
            workflowHistory: history,
          });
        } else {
          const nextStep = workflowState.nextStep;
          if (nextStep === undefined) {
            errors.push(
              `Loan ${loan.loanNumber} next workflow step is not configured`,
            );
            skipped++;
            return;
          }

          await ctx.db.patch(loanId, {
            workflowStep: nextStep,
            workflowHistory: history,
          });

          if (approvalMode !== "single") {
            await ctx.runMutation(internal.workflows.clearStepApprovals, {
              workflowType: "loan",
              entityId: loanId,
              stepNumber: currentStep,
            });
          }
        }
      } else {
        // No workflow, direct approval
        await ctx.db.patch(loanId, {
          status: "active",
          approvedBy: userId,
          approvedAt: Date.now(),
        });
      }

      // Log audit action
      await ctx.runMutation(internal.audit.logAction, {
        organizationId: loan.organizationId,
        userId,
        action: "approved",
        entityType: "loan",
        entityId: loanId,
        changes: { status: "active", bulkAction: true },
      });

      approved++;
    }),
  );

  return { approved, skipped, errors };
}

export async function bulkCancelLoansHandler(
  ctx: MutationCtx,
  args: { loanIds: Array<Id<"loans">> },
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  if (args.loanIds.length === 0) {
    return { cancelled: 0, skipped: 0, errors: [] };
  }

  let cancelled = 0;
  let skipped = 0;
  const errors: string[] = [];

  await Promise.all(
    Array.from(args.loanIds).map(async (loanId) => {
      const loan = await ctx.db.get(loanId);
      if (!loan) {
        errors.push(`Loan ${loanId} not found`);
        skipped++;
        return;
      }

      // Check permission
      try {
        await requirePermission(ctx, loan.organizationId, "loans.update");
      } catch {
        errors.push(`No permission to cancel loan ${loan.loanNumber}`);
        skipped++;
        return;
      }

      if (!ALLOWED_LOAN_TRANSITIONS[loan.status].includes("cancelled")) {
        errors.push(
          `Loan ${loan.loanNumber} cannot be cancelled (status: ${loan.status})`,
        );
        skipped++;
        return;
      }

      // Update loan status and load items in parallel
      const [, loanItems] = await Promise.all([
        ctx.db.patch(loanId, {
          status: "cancelled",
        }),
        ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", loanId))
          .collect(),
      ]);

      await Promise.all([
        ...Array.from(loanItems).map((item) =>
          markCollectionActive(ctx, {
            collectionId: item.collectionId,
            changedBy: userId,
          }),
        ),
        ctx.runMutation(internal.audit.logAction, {
          organizationId: loan.organizationId,
          userId,
          action: "cancelled",
          entityType: "loan",
          entityId: loanId,
          changes: { status: "cancelled", bulkAction: true },
        }),
      ]);

      cancelled++;
    }),
  );

  return { cancelled, skipped, errors };
}
