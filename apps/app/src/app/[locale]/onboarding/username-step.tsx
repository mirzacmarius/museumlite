"use client";

import { useForm } from "@tanstack/react-form";
import * as validators from "@v1/backend/convex/utils/validators";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/locales/client";

interface UsernameStepProps {
  onContinue: (username: string) => Promise<void>;
}

export function UsernameStep({ onContinue }: UsernameStepProps) {
  const t = useI18n();

  const usernameForm = useForm({
    defaultValues: { username: "" },
    onSubmit: async ({ value }) => {
      await onContinue(value.username);
    },
  });

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <span className="mb-2 select-none text-6xl">👋</span>
        <h3 className="text-center text-2xl font-medium text-primary">
          {t("onboardingPage.welcome")}
        </h3>
        <p className="text-center text-base font-normal text-primary/60">
          {t("onboardingPage.description")}
        </p>
      </div>

      <form
        className="flex w-full flex-col items-start gap-1"
        action={() => {
          void usernameForm.handleSubmit();
        }}
      >
        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="username" className="sr-only">
            {t("onboardingPage.usernameLabel")}
          </label>
          <usernameForm.Field
            name="username"
            validators={{ onSubmit: validators.username }}
          >
            {(field) => (
              <Input
                placeholder={t("onboardingPage.usernameLabel")}
                autoComplete="off"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className={`bg-transparent ${
                  field.state.meta?.errors.length > 0 &&
                  "border-destructive focus-visible:ring-destructive"
                }`}
              />
            )}
          </usernameForm.Field>
        </div>

        {usernameForm.state.fieldMeta.username?.errors.length > 0 && (
          <span className="mb-2 text-sm text-destructive dark:text-destructive-foreground">
            {usernameForm.state.fieldMeta.username?.errors.join(" ")}
          </span>
        )}

        <Button type="submit" size="sm" className="mt-2 w-full">
          {usernameForm.state.isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            t("onboardingPage.continue")
          )}
        </Button>
      </form>

      <p className="px-6 text-center text-sm font-normal leading-normal text-primary/60">
        {t("onboardingPage.updateNote")}
      </p>
    </div>
  );
}
