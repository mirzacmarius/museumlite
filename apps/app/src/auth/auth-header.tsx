import type { AuthMode, AuthStep } from "@/auth/types";

interface AuthHeaderProps {
  mode: AuthMode;
  step: AuthStep;
}

function getAuthHeaderTitle(mode: AuthMode, step: AuthStep): string {
  if (step === "uniqueCode") {
    return "Enter your code";
  }

  if (mode === "signUp") {
    if (step === "password") {
      return "Set your password";
    }

    return "Create your account";
  }

  if (step === "password") {
    return "Enter your password";
  }

  return "Sign in to your account";
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
      return "Choose a password to finish creating your account.";
    }

    return "Enter your email or continue with Google to register.";
  }

  if (step === "password") {
    return "Enter your password or use a unique code to continue.";
  }

  return "Enter your email or continue with Google to log in.";
}

export function AuthHeader({ mode, step }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[20px] font-semibold text-foreground">
        {getAuthHeaderTitle(mode, step)}
      </span>
      <span className="text-sm text-muted-foreground">
        {getAuthHeaderDescription({ mode, step })}
      </span>
    </div>
  );
}
