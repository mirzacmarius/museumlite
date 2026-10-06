"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

interface MappedImportValidationProps {
  rowCount: number;
  validationErrors: string[];
  onBackToMapping: () => void;
  onContinue: () => void;
}

/**
 * Client-side check after field mapping. Rows with errors are still imported
 * so the server records them as failed rows that can be corrected.
 */
export function MappedImportValidation({
  rowCount,
  validationErrors,
  onBackToMapping,
  onContinue,
}: MappedImportValidationProps) {
  const t = useScopedI18n("trackedImport");
  const validCount = rowCount - validationErrors.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("validationTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("validationSummary", {
              valid: validCount,
              errors: validationErrors.length,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBackToMapping}>
            <ArrowLeft className="mr-2 size-4" />
            {t("backToMapping")}
          </Button>
          {rowCount > 0 ? (
            <Button
              onClick={onContinue}
              className="bg-primary hover:bg-primary/90"
            >
              {t("continueWithErrors", { count: validationErrors.length })}
            </Button>
          ) : null}
        </div>
      </div>

      {validationErrors.length > 0 ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("validationErrors", { count: validationErrors.length })}
            </span>
          </div>
          <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm text-destructive">
            {Array.from(new Set(validationErrors)).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {validCount > 0 ? (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="size-4" />
            <span className="font-medium">
              {t("rowsPassed", { count: validCount })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
