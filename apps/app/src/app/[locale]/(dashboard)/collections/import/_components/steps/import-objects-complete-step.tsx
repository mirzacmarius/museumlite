"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/locales/client";
import type { ImportState } from "../import-objects-types";

interface ImportJobResult {
  processedItems?: number;
}

interface ImportObjectsCompleteStepProps {
  state: ImportState;
  importJob: ImportJobResult | null | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
  onReset: () => void;
}

export function ImportObjectsCompleteStep({
  state,
  importJob,
  t,
  onReset,
}: ImportObjectsCompleteStepProps) {
  const tRoot = useI18n();
  return (
    <div className="mx-auto max-w-md text-center">
      <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
      <h2 className="text-xl font-semibold">{t("csvImport.complete")}</h2>
      <p className="mt-2 text-muted-foreground">
        {tRoot("untranslatedRecords.collections.import.successCount", {
          count: importJob?.processedItems || state.rows.length,
        })}
      </p>

      {state.errors.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {state.errors.length}{" "}
              {tRoot("untranslatedRecords.collections.import.rowsHadIssues")}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-600">
            {state.errors.slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
            {state.errors.length > 5 ? (
              <li>
                {tRoot("untranslatedRecords.collections.import.more")}{" "}
                {state.errors.length - 5}{" "}
                {tRoot("untranslatedRecords.objects.loading.more")}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex justify-center gap-4">
        <Button variant="outline" onClick={onReset}>
          {t("csvImport.importMore")}
        </Button>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/collections">{t("csvImport.viewCollections")}</Link>
        </Button>
      </div>
    </div>
  );
}
