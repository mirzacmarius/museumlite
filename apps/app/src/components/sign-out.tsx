"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { useSignOut } from "@/hooks/use-sign-out";
import { useI18n } from "@/locales/client";

export function SignOut() {
  const translate = useI18n();
  const signOut = useSignOut();

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
