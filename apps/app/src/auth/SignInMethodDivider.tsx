"use client";

import { useI18n } from "@/locales/client";

export function SignInMethodDivider() {
  const translate = useI18n();
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-[0.06em]">
        <span className="bg-background px-2 text-muted-foreground">
          {translate("untranslatedComponents.labels.orContinueWithEmail")}
        </span>
      </div>
    </div>
  );
}
