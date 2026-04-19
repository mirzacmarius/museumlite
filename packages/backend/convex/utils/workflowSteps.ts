type WorkflowStepLike = {
  stepNumber: number;
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
