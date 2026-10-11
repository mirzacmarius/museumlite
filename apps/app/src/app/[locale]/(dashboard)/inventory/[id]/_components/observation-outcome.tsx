import type { InventoryObservationOutcome } from "@v1/backend/convex/utils/inventoryValidators";
import { cn } from "@v1/ui/utils";
import { useScopedI18n } from "@/locales/client";

/** How a scan compared with the expectation, in staff words. */
export function ObservationOutcome({
  outcome,
  observedLocationName,
  recordedLocationName,
  className,
}: {
  outcome: InventoryObservationOutcome;
  observedLocationName?: string;
  recordedLocationName?: string;
  className?: string;
}) {
  const t = useScopedI18n("inventory.scan");
  const text =
    outcome === "misplaced"
      ? t("outcomes.misplaced", { location: recordedLocationName ?? "" })
      : outcome === "unexpected"
        ? `${t("outcomes.unexpected")} · ${
            recordedLocationName
              ? t("unexpectedRecorded", { location: recordedLocationName })
              : t("unexpectedNoLocation")
          }`
        : t(`outcomes.${outcome}`);
  return (
    <p
      className={cn(
        "break-words text-xs",
        outcome === "expected" || outcome === "repeat"
          ? "text-muted-foreground"
          : "text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {observedLocationName ? `${observedLocationName} · ` : ""}
      {text}
    </p>
  );
}
