import {
  type BulkEditErrorCode,
  bulkEditErrorFromError,
} from "@v1/backend/convex/utils/bulkFieldEditErrors";
import {
  BULK_EDIT_MAX_SELECTION,
  BULK_EDIT_VALUE_LIMIT,
} from "@v1/backend/convex/utils/bulkFieldEdits";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { useCapabilityErrorMessage } from "./use-capability-error-message";

/** The translated copy for a refused bulk field edit's code. */
export function useBulkEditCodeMessage() {
  const t = useScopedI18n("objects.bulkEdit.errors");
  const locale = useCurrentLocale();
  return (code: BulkEditErrorCode) => {
    switch (code) {
      case "VALUE_REQUIRED":
        return t("valueRequired");
      case "VALUE_TOO_LONG":
        return t("valueTooLong", {
          limit: formatNumber(BULK_EDIT_VALUE_LIMIT, locale),
        });
      case "FIND_REQUIRED":
        return t("findRequired");
      case "TITLE_REQUIRED":
        return t("titleRequired");
      case "SELECTION_EMPTY":
        return t("selectionEmpty");
      case "SELECTION_TOO_LARGE":
        return t("selectionTooLarge", {
          limit: formatNumber(BULK_EDIT_MAX_SELECTION, locale),
        });
      case "SELECTION_OUTSIDE_ORGANIZATION":
        return t("selectionOutsideOrganization");
      case "EDIT_RUNNING":
        return t("editRunning");
      case "EDIT_NOT_FOUND":
        return t("editNotFound");
      case "EDIT_NOT_RESUMABLE":
        return t("editNotResumable");
    }
  };
}

/**
 * Translates refused bulk field edits and capability refusals. Any other
 * failure gets the given fallback; server text is never shown.
 */
export function useBulkEditErrorMessage(fallback: "start" | "action") {
  const t = useScopedI18n("objects.bulkEdit.errors");
  const codeMessage = useBulkEditCodeMessage();
  const capabilityMessage = useCapabilityErrorMessage();
  return (error: unknown) => {
    const data = bulkEditErrorFromError(error);
    if (data) return codeMessage(data.code);
    return (
      capabilityMessage(error) ??
      (fallback === "start" ? t("fallback") : t("actionFailed"))
    );
  };
}
