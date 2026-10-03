"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/locales/client";
import type { ImportState } from "../import-objects-types";

interface ImportJobProgress {
  processedItems?: number;
  totalItems?: number;
  progress?: number;
}

interface ImportObjectsImportingStepProps {
  state: ImportState;
  importJob: ImportJobProgress | null | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ImportObjectsImportingStep({
  state,
  importJob,
  t,
}: ImportObjectsImportingStepProps) {
  const tRoot = useI18n();
  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">{t("csvImport.importing")}</h2>
      <p className="mt-2 text-muted-foreground">
        {importJob?.processedItems || 0}{" "}
        {tRoot("untranslatedRecords.collections.import.of")}{" "}
        {importJob?.totalItems || state.rows.length}{" "}
        {tRoot("untranslatedRecords.collections.import.processed")}
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
