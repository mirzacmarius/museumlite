"use client";

import { SignInWithGoogle } from "@/auth/oauth/SignInWithGoogle";
import { SignInMethodDivider } from "@/auth/SignInMethodDivider";

interface SignInWithOAuthProps {
  redirectTo?: string;
  compact?: boolean;
  showDivider?: boolean;
}

export function SignInWithOAuth({
  redirectTo,
  compact = false,
  showDivider = false,
}: SignInWithOAuthProps) {
  return (
    <div className="space-y-4">
      {showDivider ? <SignInMethodDivider /> : null}
      <SignInWithGoogle compact={compact} redirectTo={redirectTo} />
    </div>
  );
}
