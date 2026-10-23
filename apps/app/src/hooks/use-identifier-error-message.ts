import { identifierErrorFromError } from "@v1/backend/convex/utils/identifierErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates identifier refusals (invalid, duplicate or unavailable numbers,
 * and conflict reviews that cannot be recorded).
 * Returns null for any other failure so callers keep their own handling.
 */
export function useIdentifierErrorMessage() {
  const t = useScopedI18n("identifiers");
  return (error: unknown): string | null => {
    const refusal = identifierErrorFromError(error);
    if (!refusal) return null;
    const register = t(`registers.${refusal.register ?? "catalog"}`);
    switch (refusal.code) {
      case "IDENTIFIER_INVALID":
        return t("errors.invalid");
      case "IDENTIFIER_IN_USE":
        return t("errors.inUse", {
          identifier: refusal.identifier ?? "",
          register,
        });
      case "IDENTIFIER_REVIEW_REQUIRED":
        return t("errors.reviewRequired", { register });
      case "NUMBERING_NOT_CONFIGURED":
        return t("errors.numberingNotConfigured");
      case "NUMBERING_EXHAUSTED":
        return t("errors.numberingExhausted", { register });
      case "CATALOG_NUMBER_LOCKED":
        return t("errors.catalogNumberLocked");
      case "REVIEW_NOTE_INVALID":
        return t("errors.reviewNoteInvalid");
      case "INDEX_INCOMPLETE":
        return t("errors.indexIncomplete", { register });
      case "NO_CONFLICT":
        return t("errors.noConflict", { register });
    }
  };
}
