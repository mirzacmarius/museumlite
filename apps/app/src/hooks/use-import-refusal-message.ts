import { importRefusalFromError } from "@v1/backend/convex/utils/importErrors";
import { useScopedI18n } from "@/locales/client";

/**
 * Translates imports the server refuses after upload. Returns null for any
 * other failure so callers keep their own handling.
 */
export function useImportRefusalMessage() {
  const t = useScopedI18n("trackedImport.refusals");
  return (error: unknown): string | null => {
    const refusal = importRefusalFromError(error);
    switch (refusal?.code) {
      case "IMPORT_JOB_NOT_FOUND":
        return t("jobNotFound");
      case "IMPORT_JOB_WRONG_TYPE":
        return t("jobWrongType");
      case "IMPORT_JOB_CANCELLED":
        return t("jobCancelled");
      case "IMPORT_JOB_FAILED":
        return t("jobFailed");
      case "IMPORT_TOO_MANY_ROWS":
        return t("tooManyRows", { limit: refusal.limit ?? 0 });
      case "IMPORT_ROW_NOT_IN_IMPORT":
        return t("rowNotInImport", { row: refusal.row ?? 0 });
      case "DUBLIN_CORE_NO_RECORDS":
        return t("dublinCoreNoRecords");
      case "DUBLIN_CORE_TOO_MANY_RECORDS":
        return t("dublinCoreTooManyRecords", { limit: refusal.limit ?? 0 });
      case "DUBLIN_CORE_RECORD_COUNT_CHANGED":
        return t("dublinCoreRecordCountChanged");
      case undefined:
        return null;
    }
  };
}
