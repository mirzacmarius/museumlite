"use client";

import { Loader2 } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

interface ImportProgressStepProps {
  processedItems: number;
  totalItems: number;
  progress: number;
}

export function ImportProgressStep({
  processedItems,
  totalItems,
  progress,
}: ImportProgressStepProps) {
  const t = useScopedI18n("locations");

  return (
    <div className="mx-auto max-w-md text-center">
      <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">{t("importingLocations")}</h2>
      <p className="mt-2 text-muted-foreground">
        {t("processedCount", {
          current: processedItems.toString(),
          total: totalItems.toString(),
        })}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
