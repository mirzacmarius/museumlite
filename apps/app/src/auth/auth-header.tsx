import type { AuthMode } from "@/auth/types";

interface AuthHeaderProps {
  mode: AuthMode;
}

export function AuthHeader({ mode }: AuthHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[20px] font-semibold text-white">
        {mode === "signIn"
          ? "Welcome back to MuseumLite."
          : "Create your MuseumLite account."}
      </span>
    </div>
  );
}
