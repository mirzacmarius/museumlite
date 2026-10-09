"use client";

import { useCallback } from "react";
import { useI18n } from "@/locales/client";

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  let data: unknown = error.data;
  // Error data from a nested Convex call can arrive JSON-encoded.
  while (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data &&
    typeof data === "object" &&
    "code" in data &&
    typeof data.code === "string"
    ? data.code
    : null;
}

/** Translated copy for object draft errors staff can resolve themselves. */
export function useObjectDraftErrorMessage() {
  const t = useI18n();

  return useCallback(
    (error: unknown): string | null => {
      switch (errorCode(error)) {
        case "COLLECTION_TYPE_MODULE_DISABLED":
          return t("objectTypeDetails.errors.moduleDisabled");
        case "TYPE_DETAILS_MISMATCH":
          return t("objectTypeDetails.errors.typeMismatch");
        default:
          return null;
      }
    },
    [t],
  );
}
