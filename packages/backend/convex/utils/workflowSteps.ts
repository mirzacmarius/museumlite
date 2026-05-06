type WorkflowStepLike = {
  stepNumber: number;
};

type WorkflowApprovalMode = "single" | "multi" | "unanimous";

type WorkflowApprovalStepLike = WorkflowStepLike & {
  approvalMode?: WorkflowApprovalMode;
  requiredApprovals?: number;
};

type WorkflowApprovalStatusLike = {
  currentApprovals: number;
  requiredApprovals: number;
  userHasApproved: boolean;
};

export function getPositiveWorkflowSteps<T extends WorkflowStepLike>(
  steps: readonly T[] | null | undefined,
) {
  return [...(steps ?? [])]
    .filter((step) => step.stepNumber > 0)
    .sort((left, right) => left.stepNumber - right.stepNumber);
}

export function resolveWorkflowStepState<T extends WorkflowStepLike>(
  steps: readonly T[] | null | undefined,
  requestedStep: number | null | undefined,
) {
  const approvalSteps = getPositiveWorkflowSteps(steps);
  const firstStep = approvalSteps[0]?.stepNumber;
  const lastStep = approvalSteps[approvalSteps.length - 1]?.stepNumber;

  if (firstStep === undefined || lastStep === undefined) {
    return {
      approvalSteps,
      requestedStep,
      firstStep: undefined,
      lastStep: undefined,
      currentStep: undefined,
      currentStepIndex: -1,
      nextStep: undefined,
      hasCurrentStep: false,
      isPastLastStep: false,
      isLastStep: false,
    };
  }

  const effectiveRequestedStep = requestedStep ?? firstStep;
  const currentStep =
    effectiveRequestedStep <= 0
      ? firstStep
      : effectiveRequestedStep > lastStep
        ? lastStep
        : effectiveRequestedStep;
  const currentStepIndex = approvalSteps.findIndex(
    (step) => step.stepNumber === currentStep,
  );

  return {
    approvalSteps,
    requestedStep: effectiveRequestedStep,
    firstStep,
    lastStep,
    currentStep,
    currentStepIndex,
    nextStep:
      currentStepIndex >= 0
        ? approvalSteps[currentStepIndex + 1]?.stepNumber
        : undefined,
    hasCurrentStep: currentStepIndex >= 0,
    isPastLastStep: effectiveRequestedStep > lastStep,
    isLastStep: currentStepIndex === approvalSteps.length - 1,
  };
}

export function resolveWorkflowApprovalPolicy<
  T extends WorkflowApprovalStepLike,
>(step: T | null | undefined) {
  return {
    approvalMode: step?.approvalMode ?? "single",
    requiredApprovals: step?.requiredApprovals ?? 1,
  };
}

export function resolveWorkflowApprovalDecision({
  approvalMode,
  approvalStatus,
  isPastLastStep,
  requiredApprovals,
}: {
  approvalMode: WorkflowApprovalMode;
  approvalStatus?: WorkflowApprovalStatusLike;
  isPastLastStep: boolean;
  requiredApprovals: number;
}) {
  if (isPastLastStep || approvalMode === "single") {
    return {
      effectiveRequiredApprovals: requiredApprovals,
      newApprovalCount: undefined,
      requiresStoredApproval: false,
      shouldAdvance: true,
      userHasAlreadyApproved: false,
    };
  }

  if (approvalStatus === undefined) {
    return {
      effectiveRequiredApprovals: requiredApprovals,
      newApprovalCount: undefined,
      requiresStoredApproval: true,
      shouldAdvance: false,
      userHasAlreadyApproved: false,
    };
  }

  const newApprovalCount = approvalStatus.currentApprovals + 1;
  const effectiveRequiredApprovals =
    approvalMode === "multi"
      ? requiredApprovals
      : approvalStatus.requiredApprovals;

  return {
    effectiveRequiredApprovals,
    newApprovalCount,
    requiresStoredApproval: true,
    shouldAdvance: newApprovalCount >= effectiveRequiredApprovals,
    userHasAlreadyApproved: approvalStatus.userHasApproved,
  };
}
