"use client";

import { Building2, Database, User } from "lucide-react";
import type { OnboardingStep } from "./onboarding-types";

export function StepIndicator({
  currentStep,
}: { currentStep: OnboardingStep }) {
  const steps = [
    { id: "username" as const, icon: User },
    { id: "organization" as const, icon: Building2 },
    { id: "firstData" as const, icon: Database },
  ];
  const currentIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isPast
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-5" />
            </div>
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  isPast ? "bg-primary/40" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
