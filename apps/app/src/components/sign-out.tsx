"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { useI18n } from "@/locales/client";

export function SignOut() {
  const translate = useI18n();
  const { signOut } = useAuthActions();

  return (
    <Button
      onClick={signOut}
      variant="outline"
      className="font-mono gap-2 flex items-center"
    >
      <Icons.SignOut className="size-4" />
      <span>{translate("untranslatedComponents.labels.signOut")}</span>
    </Button>
  );
}
