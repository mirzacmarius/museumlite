"use client";

import { useEffect } from "react";
import { useI18n } from "@/locales/client";

export function useBeforeUnload(isDirty: boolean, message?: string) {
  const translate = useI18n();
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        message ||
        translate(
          "untranslatedComponents.validation.unsavedChangesBeforeUnload",
        );
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, message, translate]);
}
