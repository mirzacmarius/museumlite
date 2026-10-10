"use client";

import { alertEpisodeErrorCodeFromError } from "@v1/backend/convex/utils/alertEpisodeErrors";
import { useCallback } from "react";
import { useScopedI18n } from "@/locales/client";

/** Translated copy for environmental monitoring errors staff can correct. */
export function useAlertEpisodeErrorMessage() {
  const t = useScopedI18n("locations.environment.errors");

  return useCallback(
    (error: unknown): string | null => {
      switch (alertEpisodeErrorCodeFromError(error)) {
        case "THRESHOLDS_INVALID":
          return t("thresholdsInvalid");
        case "EPISODE_NOT_OPEN":
          return t("episodeNotOpen");
        case "RESOLUTION_NOTE_INVALID":
          return t("resolutionNoteInvalid");
        case null:
          return null;
      }
    },
    [t],
  );
}
