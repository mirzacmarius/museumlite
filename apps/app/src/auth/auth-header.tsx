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
      <span className="text-[20px] font-semibold text-foreground">
        {mode === "signIn"
          ? translate("untranslatedComponents.auth.signInOrCreateAccount")
          : translate("untranslatedComponents.auth.createYourAccount")}
      </span>
      <span className="text-sm text-muted-foreground">
        {getAuthHeaderDescription({ mode, step, translate })}
      </span>
    </div>
  );
}
