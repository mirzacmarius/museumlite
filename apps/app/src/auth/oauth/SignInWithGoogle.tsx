"use client";

import { useCurrentLocale } from "@/locales/client";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SignInWithGoogleProps {
  redirectTo?: string;
  compact?: boolean;
}

export function SignInWithGoogle({
  redirectTo,
  compact = false,
}: SignInWithGoogleProps) {
  const { signIn } = useAuthActions();
  const locale = useCurrentLocale();
  const router = useRouter();

  return (
    <Button
      className={compact ? "w-full h-9" : "w-full h-10"}
      onClick={async () => {
        try {
          const result = await signIn(
            "google",
            redirectTo ? { redirectTo } : undefined,
          );

          if (result.signingIn) {
            router.push(redirectTo ?? `/${locale}`);
            router.refresh();
          }
        } catch {
          toast.error("Could not start Google sign-in. Please try again.");
        }
      }}
      type="button"
      variant="outline"
    >
      Continue with Google
    </Button>
  );
}
