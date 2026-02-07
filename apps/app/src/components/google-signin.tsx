"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";

interface GoogleSigninProps {
  redirectTo?: string;
}

export function GoogleSignin({ redirectTo }: GoogleSigninProps) {
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
      className="font-mono"
    >
      Sign in with Google
    </Button>
  );
}
