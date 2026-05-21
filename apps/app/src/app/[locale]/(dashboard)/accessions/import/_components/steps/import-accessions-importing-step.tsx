"use client";

import { Loader2 } from "lucide-react";
import type { ImportState } from "../import-accessions-types";

interface ImportJobProgress {
  processedItems?: number;
  totalItems?: number;
  progress?: number;
}

interface ImportAccessionsImportingStepProps {
  state: ImportState;
  importJob: ImportJobProgress | null | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ImportAccessionsImportingStep({
  state,
  importJob,
  t,
}: ImportAccessionsImportingStepProps) {
  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">{t("import.importing")}</h2>
      <p className="mt-2 text-muted-foreground">
        {t("import.progress", {
          current: importJob?.processedItems || 0,
          total: importJob?.totalItems || state.rows.length,
        })}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${importJob?.progress || 0}%` }}
        />
      </div>
    </div>
  );
}
