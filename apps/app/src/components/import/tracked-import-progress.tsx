"use client";

import { Button } from "@v1/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";

interface TrackedImportProgressProps {
  importJob:
    | {
        status: string;
        progress: number;
        totalItems: number;
        attemptedItems: number;
        acceptedItems: number;
        failedItems: number;
      }
    | null
    | undefined;
  fallbackTotal: number;
  onCancel: () => Promise<void>;
  /** Overrides the row-oriented progress line, e.g. when items are files. */
  detail?: string;
}

export function TrackedImportProgress({
  importJob,
  fallbackTotal,
  onCancel,
  detail,
}: TrackedImportProgressProps) {
  const t = useScopedI18n("trackedImport");
  const [cancelling, setCancelling] = useState(false);
  const cancelled = importJob?.status === "cancelled";

  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">{t("progressTitle")}</h2>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        {detail ??
          t("progressDetail", {
            attempted: importJob?.attemptedItems ?? 0,
            total: importJob?.totalItems ?? fallbackTotal,
            accepted: importJob?.acceptedItems ?? 0,
            failed: importJob?.failedItems ?? 0,
          })}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${importJob?.progress ?? 0}%` }}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-6"
        disabled={cancelling || cancelled}
        onClick={async () => {
          setCancelling(true);
          try {
            await onCancel();
          } finally {
            setCancelling(false);
          }
        }}
      >
        {cancelled ? t("cancelling") : t("cancelImport")}
      </Button>
    </div>
  );
}
