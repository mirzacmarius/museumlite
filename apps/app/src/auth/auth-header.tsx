import type { AuthMode } from "@/auth/types";

interface AuthHeaderProps {
  mode: AuthMode;
}

export function AuthHeader({ mode }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[20px] font-semibold text-white">
        {mode === "signIn"
          ? "Sign in or create your account."
          : "Create your account."}
      </span>
      <span className="text-sm text-white/60">
        {mode === "signIn"
          ? "Use your email or Google account. New users will continue directly to account setup."
          : "Already registered? Enter your email and we will guide you back to sign in."}
      </span>
    </div>
  );
}
