import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { readWorkflowHistoryPage } from "../auditLog";
import { appendCaseHistory } from "./caseHistory";
import { markCollectionActive } from "./collectionLifecycle";
import { requireCapabilityEntitlement } from "./featureGates";
import {
  ALLOWED_LOAN_TRANSITIONS,
  assertAllowedLoanTransition,
} from "./loanStatusTransitions";
import { dispatchNotification } from "./notificationDispatch";
import {
  getOrganizationNotificationRecipients,
  getWorkflowCreatorRecipient,
} from "./notificationRecipients";
import {
  canApproveAtStep,
  requireCapability,
  resolveCaseApproval,
} from "./permissions";
import { suggestPreparation, withdrawPreparation } from "./preparation";
import { workflowApprovalError } from "./workflowApprovalErrors";
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

  await requireCapability(ctx, loan.organizationId, "loans", "loans.approve");
  const approval = await resolveCaseApproval(
    ctx,
    loan.organizationId,
    "loan",
    loan.workflowStep,
  );
  if (!approval.allowed) {
    throw approval.refusal;
  }

  if (approval.workflow) {
    const {
      config: workflowConfig,
      state: workflowState,
      currentStep,
    } = approval.workflow;

    const currentStepConfig = workflowConfig.steps.find(
      (step) => step.stepNumber === currentStep,
    );
    if (!currentStepConfig) {
      throw workflowApprovalError(
        "WORKFLOW_NOT_CONFIGURED",
        "Current workflow step is not configured",
      );
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

    const history = [...(loan.workflowHistory ?? [])];
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
          ...(await appendCaseHistory(ctx, loan, "loan", history)),
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
      await suggestPreparation(
        ctx,
        {
          organizationId: loan.organizationId,
          caseType: "loan",
          caseId: args.loanId,
        },
        userId,
      );
      const { itemName, itemCount } = await getLoanEmailItemData(
        ctx,
        args.loanId,
      );
      const creatorId = getWorkflowCreatorRecipient(history, userId);
      if (creatorId && creatorId !== userId) {
        await dispatchNotification(ctx, {
          organizationId: loan.organizationId,
          type: "loan_approved",
          recipients: [creatorId],
          title: "Loan Approved",
          message: `Loan ${loan.loanNumber} has been fully approved and is now active.`,
          related: { entityType: "loan", entityId: args.loanId },
          email: {
            kind: "loanApproved",
            loanId: args.loanId,
            itemName,
            borrowerName: loan.lenderBorrowerName,
            startDate: loan.startDate,
            endDate: loan.endDate,
            itemCount,
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
        ...(await appendCaseHistory(ctx, loan, "loan", history)),
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
    await suggestPreparation(
      ctx,
      {
        organizationId: loan.organizationId,
        caseType: "loan",
        caseId: args.loanId,
      },
      userId,
    );
    const [recipients, loanItemData] = await Promise.all([
      getOrganizationNotificationRecipients(ctx, loan.organizationId, userId),
      getLoanEmailItemData(ctx, args.loanId),
    ] as const);
    const { itemName, itemCount } = loanItemData;
    await dispatchNotification(ctx, {
      organizationId: loan.organizationId,
      type: "loan_approved",
      recipients,
      title: "Loan Approved",
      message: `Loan ${loan.loanNumber} has been approved and is now active.`,
      related: { entityType: "loan", entityId: args.loanId },
      email: {
        kind: "loanApproved",
        loanId: args.loanId,
        itemName,
        borrowerName: loan.lenderBorrowerName,
        startDate: loan.startDate,
        endDate: loan.endDate,
        itemCount,
      },
    });
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

  // A step's Role may reject without loans.approve, but never past the plan.
  if (canApprove) {
    await requireCapabilityEntitlement(ctx, loan.organizationId, "loans");
  } else {
    await requireCapability(ctx, loan.organizationId, "loans", "loans.approve");
  }

  const history = [...(loan.workflowHistory ?? [])];
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
      ...(await appendCaseHistory(ctx, loan, "loan", history)),
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
  const creatorId = getWorkflowCreatorRecipient(history, userId);
  if (creatorId && creatorId !== userId) {
    await dispatchNotification(ctx, {
      organizationId: loan.organizationId,
      type: "loan_rejected",
      recipients: [creatorId],
      title: "Loan Rejected",
      message: `Loan ${loan.loanNumber} has been rejected.${args.comment ? ` Reason: ${args.comment}` : ""}`,
      related: { entityType: "loan", entityId: args.loanId },
      email: {
        kind: "loanRejected",
        loanId: args.loanId,
        itemName,
        borrowerName: loan.lenderBorrowerName,
        startDate: loan.startDate,
        endDate: loan.endDate,
        itemCount,
      },
    });
  }

  return null;
}

export async function getLoanWorkflowHistoryHandler(
  ctx: QueryCtx,
  args: { loanId: Id<"loans">; cursor?: number; limit?: number },
) {
  const loan = await ctx.db.get(args.loanId);
  if (!loan) {
    throw new Error("Loan not found");
  }

  await requireCapability(ctx, loan.organizationId, "loans", "loans.read");

  return await readWorkflowHistoryPage(ctx, {
    organizationId: loan.organizationId,
    caseType: "loan",
    entityId: args.loanId,
    cursor: args.cursor,
    limit: args.limit,
  });
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
        await requireCapability(
          ctx,
          loan.organizationId,
          "loans",
          "loans.approve",
        );
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
      let approvedNow = false;

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

        const history = [...(loan.workflowHistory ?? [])];
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
            ...(await appendCaseHistory(ctx, loan, "loan", history)),
          });
          approvedNow = true;
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
            ...(await appendCaseHistory(ctx, loan, "loan", history)),
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
        approvedNow = true;
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
      if (approvedNow)
        await suggestPreparation(
          ctx,
          {
            organizationId: loan.organizationId,
            caseType: "loan",
            caseId: loanId,
          },
          userId,
        );

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
        await requireCapability(
          ctx,
          loan.organizationId,
          "loans",
          "loans.update",
        );
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
      await withdrawPreparation(
        ctx,
        {
          organizationId: loan.organizationId,
          caseType: "loan",
          caseId: loanId,
        },
        userId,
        "loan_cancelled",
      );

      cancelled++;
    }),
  );

  return { cancelled, skipped, errors };
}
