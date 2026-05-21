"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { ImportState } from "../import-accessions-types";

interface ImportJobResult {
  processedItems?: number;
}

interface ImportAccessionsCompleteStepProps {
  state: ImportState;
  importJob: ImportJobResult | null | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
  onReset: () => void;
}

export function ImportAccessionsCompleteStep({
  state,
  importJob,
  t,
  onReset,
}: ImportAccessionsCompleteStepProps) {
  return (
    <div className="mx-auto max-w-md text-center">
      <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
      <h2 className="text-xl font-semibold">{t("import.complete")}</h2>
      <p className="mt-2 text-muted-foreground">
        {t("import.successMessage", {
          count: importJob?.processedItems || state.rows.length,
        })}
      </p>

      {state.errors.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("import.issuesMessage", { count: state.errors.length })}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-600">
            {state.errors.slice(0, 5).map((error) => (
              <li key={error}>• {error}</li>
            ))}
            {state.errors.length > 5 ? (
              <li>• ... and {state.errors.length - 5} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex justify-center gap-4">
        <Button variant="outline" onClick={onReset}>
          {t("import.importMore")}
        </Button>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/accessions">{t("import.viewAccessions")}</Link>
        </Button>
      </div>
    </div>
  );
}
