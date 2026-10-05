"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import type { ImportState } from "../import-accessions-types";

interface ImportAccessionsValidationStepProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  onBackToMapping: () => void;
  onContinueAfterValidation: () => void;
}

export function ImportAccessionsValidationStep({
  state,
  t,
  onBackToMapping,
  onContinueAfterValidation,
}: ImportAccessionsValidationStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {t("import.validationTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("import.validationSummary", {
              valid: state.rows.length - state.validationErrors.length,
              errors: state.validationErrors.length,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBackToMapping}>
            <ArrowLeft className="mr-2 size-4" />
            {t("import.backToMapping")}
          </Button>
          {state.rows.length > 0 ? (
            <Button
              onClick={onContinueAfterValidation}
              className="bg-primary hover:bg-primary/90"
            >
              {t("import.continueWithErrors", {
                count: state.validationErrors.length,
              })}
            </Button>
          ) : null}
        </div>
      </div>

      {state.validationErrors.length > 0 ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("import.validationErrors", {
                count: state.validationErrors.length,
              })}
            </span>
          </div>
          <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm text-destructive">
            {Array.from(new Set(state.validationErrors)).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.rows.length > state.validationErrors.length ? (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="size-4" />
            <span className="font-medium">
              {t("import.rowsPassed", {
                count: state.rows.length - state.validationErrors.length,
              })}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
