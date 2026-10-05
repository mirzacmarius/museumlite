import type { AuthMode, AuthStep } from "@/auth/types";
import { useI18n } from "@/locales/client";

interface AuthHeaderProps {
  mode: AuthMode;
  step: AuthStep;
}

function getAuthHeaderDescription({
  mode,
  step,
  translate,
}: {
  mode: AuthMode;
  step: AuthStep;
  translate: ReturnType<typeof useI18n>;
}): string {
  if (step === "uniqueCode") {
    return translate("untranslatedComponents.auth.checkEmailForCode");
  }

  if (mode === "signUp") {
    if (step === "password") {
      return translate("untranslatedComponents.auth.setPasswordToFinishSetup");
    }

    return translate("untranslatedComponents.auth.alreadyRegisteredEnterEmail");
  }

  if (step === "password") {
    return translate("untranslatedComponents.auth.enterPasswordOrCode");
  }

  return translate("untranslatedComponents.auth.useEmailOrGoogle");
}

export function AuthHeader({ mode, step }: AuthHeaderProps) {
  const translate = useI18n();
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {mode === "signIn"
          ? translate("loginPage.heading")
          : translate("registerPage.heading")}
      </h1>
      <span className="text-sm text-muted-foreground">
        {mode === "signIn" && step === "email"
          ? translate("loginPage.description")
          : getAuthHeaderDescription({ mode, step, translate })}
      </span>
    </div>
  );
}
