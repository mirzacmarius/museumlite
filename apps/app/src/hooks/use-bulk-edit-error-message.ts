import {
  type BulkEditErrorCode,
  bulkEditErrorFromError,
} from "@v1/backend/convex/utils/bulkFieldEditErrors";
import { useScopedI18n } from "@/locales/client";
import { useCapabilityErrorMessage } from "./use-capability-error-message";

/**
 * Translates refused bulk field edits and capability refusals. Any other
 * failure gets the translated fallback; server text is never shown.
 */
export function useBulkEditErrorMessage() {
  const t = useScopedI18n("objects.bulkEdit.errors");
  const capabilityMessage = useCapabilityErrorMessage();
  function codeMessage(code: BulkEditErrorCode) {
    switch (code) {
      case "VALUE_REQUIRED":
        return t("valueRequired");
      case "VALUE_TOO_LONG":
        return t("valueTooLong");
      case "FIND_REQUIRED":
        return t("findRequired");
      case "TITLE_REQUIRED":
        return t("titleRequired");
      case "SELECTION_EMPTY":
        return t("selectionEmpty");
      case "SELECTION_TOO_LARGE":
        return t("selectionTooLarge");
      case "SELECTION_OUTSIDE_ORGANIZATION":
        return t("selectionOutsideOrganization");
      case "EDIT_RUNNING":
        return t("editRunning");
      case "EDIT_NOT_FOUND":
        return t("editNotFound");
      case "EDIT_NOT_RESUMABLE":
        return t("editNotResumable");
    }
  }

  return (error: unknown) => {
    const data = bulkEditErrorFromError(error);
    if (data) return codeMessage(data.code);
    return capabilityMessage(error) ?? t("fallback");
  };
}
