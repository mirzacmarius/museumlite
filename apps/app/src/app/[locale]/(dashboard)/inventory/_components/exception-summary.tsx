import type { InventoryExceptionKind } from "@v1/backend/convex/utils/inventoryValidators";
import { useScopedI18n } from "@/locales/client";

/** One line on what differed: where the record placed it and where it was seen. */
export function ExceptionSummary({
  exception,
}: {
  exception: {
    kind: InventoryExceptionKind;
    recordedLocationName?: string;
    observedLocationName?: string;
  };
}) {
  const t = useScopedI18n("inventory.exceptions.summaries");
  const recorded = exception.recordedLocationName ?? "";
  const observed = exception.observedLocationName ?? "";
  switch (exception.kind) {
    case "missing":
      return t("missing", { recorded });
    case "misplaced":
      return t("misplaced", { recorded, observed });
    case "unexpected":
      return exception.recordedLocationName
        ? t("unexpected", { recorded, observed })
        : t("unexpectedNoLocation", { observed });
    case "unknown_label":
      return t("unknown_label", { observed });
  }
}
