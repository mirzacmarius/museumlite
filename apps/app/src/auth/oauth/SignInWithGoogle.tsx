"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCurrentLocale, useI18n } from "@/locales/client";

interface SignInWithGoogleProps {
  redirectTo?: string;
  compact?: boolean;
}

export function SignInWithGoogle({
  redirectTo,
  compact = false,
}: SignInWithGoogleProps) {
  const translate = useI18n();
  const { signIn } = useAuthActions();
  const locale = useCurrentLocale();
  const { push, refresh } = useRouter();

  return (
    <Button
      className={compact ? "w-full h-9" : "w-full h-10"}
      onClick={async () => {
        try {
          const result = await signIn("google", {
            redirectTo: redirectTo ?? `/${locale}`,
          });

          if (result.signingIn) {
            push(redirectTo ?? `/${locale}`);
            refresh();
          }
        } catch {
          toast.error(
            translate("untranslatedComponents.auth.googleSignInFailed"),
          );
        }
      }}
      type="button"
      variant="outline"
    >
      {translate("untranslatedComponents.labels.continueWithGoogle")}
    </Button>
  );
}
