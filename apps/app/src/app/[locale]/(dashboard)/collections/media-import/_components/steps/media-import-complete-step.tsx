"use client";

import { Button } from "@v1/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { MediaImportState } from "../media-import-types";

interface MediaImportJob {
  processedItems?: number;
  successfulMappings?: number;
  failedMappings?: number;
}

interface MediaImportCompleteStepProps {
  state: MediaImportState;
  importJob: MediaImportJob | null | undefined;
  t: (key: string) => string;
  onReset: () => void;
  onGoToReviewUnmapped: () => void;
}

export function MediaImportCompleteStep({
  state,
  importJob,
  t,
  onReset,
  onGoToReviewUnmapped,
}: MediaImportCompleteStepProps) {
  return (
    <div className="mx-auto max-w-md text-center pt-8">
      <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
      <h2 className="text-xl font-semibold">{t("mediaImport.complete")}</h2>
      <p className="mt-2 text-muted-foreground">
        Processed {importJob?.processedItems} files
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-2xl font-bold text-green-600">
            {importJob?.successfulMappings || 0}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("mediaImport.mapped")}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="text-2xl font-bold text-amber-600">
            {importJob?.failedMappings || 0}
          </div>
          <div className="text-sm text-muted-foreground">
            {t("mediaImport.unmapped")}
          </div>
        </div>
      </div>

      {state.uploadErrors.length > 0 && (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-left">
          <div className="font-medium text-destructive mb-2">Upload Errors</div>
          <ul className="text-sm text-destructive space-y-1 max-h-32 overflow-y-auto">
            {state.uploadErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {(importJob?.failedMappings || 0) > 0 && (
          <Button
            className="w-full bg-amber-600 hover:bg-amber-500"
            onClick={onGoToReviewUnmapped}
          >
            Review {importJob?.failedMappings} Unmapped Files
          </Button>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onReset}>
            {t("csvImport.importMore")}
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/collections">{t("csvImport.viewCollections")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
