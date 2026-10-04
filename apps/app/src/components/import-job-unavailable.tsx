"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle } from "lucide-react";
import { useScopedI18n } from "@/locales/client";

export function ImportJobUnavailable({ onReset }: { onReset: () => void }) {
  const t = useScopedI18n("common");

  return (
    <div className="mx-auto max-w-md text-center">
      <AlertCircle className="mx-auto mb-4 size-12 text-amber-500" />
      <h2 className="text-xl font-semibold">{t("importJobUnavailable")}</h2>
      <p className="mt-2 text-muted-foreground">
        {t("importJobUnavailableDescription")}
      </p>
      <Button className="mt-6" onClick={onReset}>
        {t("startNewImport")}
      </Button>
    </div>
  );
}
