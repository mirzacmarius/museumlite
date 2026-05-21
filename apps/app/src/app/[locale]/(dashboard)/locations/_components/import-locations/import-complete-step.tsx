"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useScopedI18n } from "@/locales/client";

interface ImportCompleteStepProps {
  importedCount: number;
  runtimeErrors: string[];
  onReset: () => void;
}

export function ImportCompleteStep({
  importedCount,
  runtimeErrors,
  onReset,
}: ImportCompleteStepProps) {
  const t = useScopedI18n("locations");

  return (
    <div className="mx-auto max-w-md text-center">
      <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
      <h2 className="text-xl font-semibold">{t("importComplete")}</h2>
      <p className="mt-2 text-muted-foreground">
        {t("successfullyImported", { count: importedCount.toString() })}
      </p>

      {runtimeErrors.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("rowsHadIssues", {
                count: runtimeErrors.length.toString(),
              })}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-600">
            {runtimeErrors.slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
            {runtimeErrors.length > 5 && (
              <li>
                {t("importErrors.andMore", {
                  count: (runtimeErrors.length - 5).toString(),
                })}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <Button variant="outline" onClick={onReset}>
          {t("importMore")}
        </Button>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/locations">{t("viewLocations")}</Link>
        </Button>
      </div>
    </div>
  );
}
