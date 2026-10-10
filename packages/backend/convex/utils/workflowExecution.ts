import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { dispatchNotification } from "./notificationDispatch";
import { getUsersToNotifyForWorkflowStep } from "./permissions";
import {
  resolveWorkflowApprovalDecision,
  resolveWorkflowApprovalPolicy,
} from "./workflowSteps";

type ExecutableWorkflowType = "accession" | "deaccession" | "loan";

type WorkflowEntityId = Id<"accessions"> | Id<"deaccessions"> | Id<"loans">;

type WorkflowApprovalStep = {
  stepNumber: number;
  approvalMode?: "single" | "multi" | "unanimous";
  requiredApprovals?: number;
};

type WorkflowAdvanceNotification = {
  title: string;
  message: string;
};

type WorkflowStepAdvancePreparationArgs = {
  organizationId: Id<"organizations">;
  workflowType: ExecutableWorkflowType;
  fromStep: number;
  toStep: number | undefined;
  validateTransition?: boolean;
};

type WorkflowStepAdvanceArgs = {
  organizationId: Id<"organizations">;
  workflowType: ExecutableWorkflowType;
  entityId: WorkflowEntityId;
  fromStep: number;
  toStep: number;
  performedBy: Id<"users">;
  comment?: string;
  notification: WorkflowAdvanceNotification;
  recordWorkflowHistory?: boolean;
};

type WorkflowStepApprovalArgs = {
  organizationId: Id<"organizations">;
  workflowType: ExecutableWorkflowType;
  entityId: WorkflowEntityId;
  stepNumber: number;
  step: WorkflowApprovalStep;
  performedBy: Id<"users">;
  comment?: string;
  isPastLastStep: boolean;
};

function resolveNextWorkflowStep(toStep: number | undefined) {
  if (toStep === undefined) {
    throw new Error("Next workflow step is not configured");
  }

  return toStep;
}

async function validateWorkflowTransition(
  ctx: MutationCtx,
  {
    fromStep,
    organizationId,
    toStep,
    workflowType,
  }: {
    organizationId: Id<"organizations">;
    workflowType: ExecutableWorkflowType;
    fromStep: number;
    toStep: number;
  },
) {
  const transitionValid = await ctx.runQuery(
    internal.workflows.validateTransition,
    {
      organizationId,
      workflowType,
      fromStep,
      toStep,
    },
  );

  if (!transitionValid.valid) {
    throw new Error(transitionValid.reason ?? "Invalid transition");
  }
}

export async function prepareWorkflowStepAdvance(
  ctx: MutationCtx,
  {
    fromStep,
    organizationId,
    toStep,
    validateTransition = false,
    workflowType,
  }: WorkflowStepAdvancePreparationArgs,
) {
  const nextStep = resolveNextWorkflowStep(toStep);

  if (validateTransition) {
    await validateWorkflowTransition(ctx, {
      organizationId,
      workflowType,
      fromStep,
      toStep: nextStep,
    });
  }

  return nextStep;
}

export async function recordWorkflowStepApproval(
  ctx: MutationCtx,
  {
    comment,
    entityId,
    isPastLastStep,
    organizationId,
    performedBy,
    step,
    stepNumber,
    workflowType,
  }: WorkflowStepApprovalArgs,
) {
  const { approvalMode, requiredApprovals } =
    resolveWorkflowApprovalPolicy(step);
  let approvalDecision = resolveWorkflowApprovalDecision({
    approvalMode,
    isPastLastStep,
    requiredApprovals,
  });

  if (!approvalDecision.requiresStoredApproval) {
    return {
      approvalDecision,
      approvalMode,
    };
  }

  const approvalStatus = await ctx.runQuery(
    internal.workflows.checkStepApprovalStatus,
    {
      organizationId,
      workflowType,
      entityId,
      stepNumber,
      userId: performedBy,
    },
  );

  approvalDecision = resolveWorkflowApprovalDecision({
    approvalMode,
    approvalStatus,
    isPastLastStep,
    requiredApprovals,
  });

  if (approvalDecision.userHasAlreadyApproved) {
    throw new Error("You have already approved this step");
  }

  await ctx.runMutation(internal.workflows.recordStepApproval, {
    organizationId,
    workflowType,
    entityId,
    stepNumber,
    approvedBy: performedBy,
    comment,
  });

  if (!approvalDecision.shouldAdvance) {
    await ctx.runMutation(internal.workflows.recordWorkflowHistory, {
      organizationId,
      workflowType,
      entityId,
      fromStep: stepNumber,
      toStep: stepNumber,
      action: "approved",
      performedBy,
      comment,
      metadata: {
        approvalMode,
        currentApprovals: String(approvalDecision.newApprovalCount),
        requiredApprovals: String(approvalDecision.effectiveRequiredApprovals),
      },
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId: performedBy,
      action: "partial_approval",
      entityType: workflowType,
      entityId,
      changes: {
        step: stepNumber,
        approvalMode,
        currentApprovals: approvalDecision.newApprovalCount,
        requiredApprovals: approvalDecision.effectiveRequiredApprovals,
      },
    });
  }

  return {
    approvalDecision,
    approvalMode,
  };
}

export async function recordWorkflowStepAdvance(
  ctx: MutationCtx,
  {
    comment,
    entityId,
    fromStep,
    notification,
    organizationId,
    performedBy,
    recordWorkflowHistory = false,
    toStep,
    workflowType,
  }: WorkflowStepAdvanceArgs,
) {
  const usersToNotify = await Promise.all([
    recordWorkflowHistory
      ? ctx.runMutation(internal.workflows.recordWorkflowHistory, {
          organizationId,
          workflowType,
          entityId,
          fromStep,
          toStep,
          action: "approved",
          performedBy,
          comment,
        })
      : Promise.resolve(),
    ctx.runMutation(internal.audit.logAction, {
      organizationId,
      userId: performedBy,
      action: "step_approved",
      entityType: workflowType,
      entityId,
      changes: { step: fromStep, nextStep: toStep },
    }),
    getUsersToNotifyForWorkflowStep(ctx, organizationId, workflowType, toStep),
  ]).then(([, , notifyUsers]) => notifyUsers);

  await dispatchNotification(ctx, {
    organizationId,
    type: "workflow_pending",
    recipients: usersToNotify.filter(
      (approverId) => approverId !== performedBy,
    ),
    title: notification.title,
    message: notification.message,
    related: { entityType: workflowType, entityId },
  });

  return null;
}
