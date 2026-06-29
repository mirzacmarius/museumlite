import type { AuthMode, AuthStep } from "@/auth/types";

interface AuthHeaderProps {
  mode: AuthMode;
  step: AuthStep;
}

function getAuthHeaderDescription({
  mode,
  step,
}: {
  mode: AuthMode;
  step: AuthStep;
}): string {
  if (step === "uniqueCode") {
    return "Check your email for the code to continue.";
  }

  if (mode === "signUp") {
    if (step === "password") {
      return "Set a password to finish account setup. If this is not your email, clear it and enter another.";
    }

    return "Already registered? Enter your email and we will guide you back to sign in.";
  }

  if (step === "password") {
    return "Enter your password or use a unique code to continue.";
  }

  return "Use your email or Google account. New users will continue directly to account setup.";
}

export function AuthHeader({ mode, step }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[20px] font-semibold text-foreground">
        {mode === "signIn"
          ? "Sign in or create your account."
          : "Create your account."}
      </span>
      <span className="text-sm text-muted-foreground">
        {getAuthHeaderDescription({ mode, step })}
      </span>
    </div>
  );
}
