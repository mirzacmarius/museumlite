"use client";

import { Button } from "@v1/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import type { ImportState } from "../import-accessions-types";

interface ImportJobProgress {
  attemptedItems?: number;
  acceptedItems?: number;
  failedItems?: number;
  totalItems?: number;
  progress?: number;
  status?: string;
}

interface ImportAccessionsImportingStepProps {
  state: ImportState;
  importJob: ImportJobProgress | null | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
  onCancel: () => Promise<void>;
}

export function ImportAccessionsImportingStep({
  state,
  importJob,
  t,
  onCancel,
}: ImportAccessionsImportingStepProps) {
  const [cancelling, setCancelling] = useState(false);
  const cancelled = importJob?.status === "cancelled";

  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">{t("import.importing")}</h2>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        {t("import.progressDetail", {
          attempted: importJob?.attemptedItems ?? 0,
          total: importJob?.totalItems ?? state.rows.length,
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
        {cancelled ? t("import.cancelling") : t("import.cancelImport")}
      </Button>
    </div>
  );
}
