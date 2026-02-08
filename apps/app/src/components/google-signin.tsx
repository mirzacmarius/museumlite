"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";

interface GoogleSigninProps {
  redirectTo?: string;
  label?: string;
}

export function GoogleSignin({ redirectTo, label }: GoogleSigninProps) {
  const { signIn } = useAuthActions();

  return (
    <Button
      onClick={() => {
        if (redirectTo) {
          signIn("google", { redirectTo });
          return;
        }
        signIn("google");
      }}
      variant="outline"
      className="w-full font-mono"
    >
      {label ?? "Sign in with Google"}
    </Button>
  );
}
