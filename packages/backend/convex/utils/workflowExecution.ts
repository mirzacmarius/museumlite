import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getUsersToNotifyForWorkflowStep } from "./permissions";

type ExecutableWorkflowType = "accession" | "deaccession" | "loan";

type WorkflowEntityId = Id<"accessions"> | Id<"deaccessions"> | Id<"loans">;

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
  if (recordWorkflowHistory) {
    await ctx.runMutation(internal.workflows.recordWorkflowHistory, {
      organizationId,
      workflowType,
      entityId,
      fromStep,
      toStep,
      action: "approved",
      performedBy,
      comment,
    });
  }

  await ctx.runMutation(internal.audit.logAction, {
    organizationId,
    userId: performedBy,
    action: "step_approved",
    entityType: workflowType,
    entityId,
    changes: { step: fromStep, nextStep: toStep },
  });

  const usersToNotify = await getUsersToNotifyForWorkflowStep(
    ctx,
    organizationId,
    workflowType,
    toStep,
  );

  for (const approverId of usersToNotify) {
    if (approverId !== performedBy) {
      await ctx.runMutation(internal.audit.createNotificationInternal, {
        organizationId,
        userId: approverId,
        type: "workflow_pending",
        title: notification.title,
        message: notification.message,
        relatedEntityType: workflowType,
        relatedEntityId: entityId,
      });
    }
  }

  return null;
}
