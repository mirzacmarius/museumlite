"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "../utils";
import { Button } from "./button";

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
}

interface WizardContextValue {
  steps: WizardStep[];
  currentStep: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  goToStep: (index: number) => void;
  goNext: () => void;
  goPrev: () => void;
  setCanGoNext: (canGo: boolean) => void;
  completedSteps: Set<number>;
  markStepComplete: (index: number) => void;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

function useWizard() {
  const context = React.use(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within a Wizard");
  }
  return context;
}

interface WizardProps {
  steps: WizardStep[];
  children: React.ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onComplete?: () => void;
  className?: string;
}

function Wizard({
  steps,
  children,
  initialStep = 0,
  onStepChange,
  onComplete,
  className,
}: WizardProps) {
  const [currentStep, setCurrentStep] = React.useState(initialStep);
  const [canGoNext, setCanGoNext] = React.useState(true);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(
    new Set(),
  );

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const goToStep = React.useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) {
        setCurrentStep(index);
        onStepChange?.(index);
      }
    },
    [steps.length, onStepChange],
  );

  const goNext = React.useCallback(() => {
    if (isLastStep) {
      onComplete?.();
    } else {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      goToStep(currentStep + 1);
    }
  }, [currentStep, isLastStep, goToStep, onComplete]);

  const goPrev = React.useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const markStepComplete = React.useCallback((index: number) => {
    setCompletedSteps((prev) => new Set([...prev, index]));
  }, []);

  const value: WizardContextValue = {
    steps,
    currentStep,
    isFirstStep,
    isLastStep,
    canGoNext,
    canGoPrev: !isFirstStep,
    goToStep,
    goNext,
    goPrev,
    setCanGoNext,
    completedSteps,
    markStepComplete,
  };

  return (
    <WizardContext.Provider value={value}>
      <div className={cn("flex flex-col", className)}>{children}</div>
    </WizardContext.Provider>
  );
}

interface WizardStepsProps {
  className?: string;
}

function WizardSteps({ className }: WizardStepsProps) {
  const { steps, currentStep, completedSteps, goToStep } = useWizard();

  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent = index === currentStep;
          const isClickable = index < currentStep || completedSteps.has(index);

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex-1",
                index !== steps.length - 1 && "pr-8 sm:pr-20",
              )}
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => isClickable && goToStep(index)}
                  disabled={!isClickable}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background text-muted-foreground",
                    isClickable &&
                      !isCurrent &&
                      "cursor-pointer hover:border-primary/50",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="size-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                {index !== steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-8 top-4 -ml-px h-0.5 w-full",
                      isCompleted ? "bg-emerald-500" : "bg-muted-foreground/30",
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="mt-2 min-w-0">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface WizardContentProps {
  children: React.ReactNode;
  className?: string;
}

function WizardContent({ children, className }: WizardContentProps) {
  const { currentStep } = useWizard();
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={cn("flex-1", className)}>{childrenArray[currentStep]}</div>
  );
}

interface WizardStepContentProps {
  children: React.ReactNode;
  className?: string;
}

function WizardStepContent({ children, className }: WizardStepContentProps) {
  return <div className={className}>{children}</div>;
}

interface WizardFooterProps {
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
  showPrev?: boolean;
  showNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

function WizardFooter({
  className,
  prevLabel = "Back",
  nextLabel = "Continue",
  completeLabel = "Complete",
  showPrev = true,
  showNext = true,
  onPrev,
  onNext,
}: WizardFooterProps) {
  const { isFirstStep, isLastStep, canGoNext, canGoPrev, goNext, goPrev } =
    useWizard();

  const handlePrev = () => {
    onPrev?.();
    goPrev();
  };

  const handleNext = () => {
    onNext?.();
    goNext();
  };

  return (
    <div className={cn("flex items-center justify-between pt-6", className)}>
      <div>
        {showPrev && !isFirstStep && (
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrev}
            disabled={!canGoPrev}
          >
            <ChevronLeft className="mr-1 size-4" />
            {prevLabel}
          </Button>
        )}
      </div>

      <div>
        {showNext && (
          <Button type="button" onClick={handleNext} disabled={!canGoNext}>
            {isLastStep ? completeLabel : nextLabel}
            {!isLastStep && <ChevronRight className="ml-1 size-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

export {
  Wizard,
  WizardSteps,
  WizardContent,
  WizardStepContent,
  WizardFooter,
  useWizard,
  type WizardStep,
};
