"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useScopedI18n } from "@/locales/client";

interface AccessionsErrorProps {
  error?: Error;
  message?: string;
}

export function AccessionsError({ error, message }: AccessionsErrorProps) {
  const { refresh } = useRouter();
  const t = useScopedI18n("accessions");
  const tCommon = useScopedI18n("common");

  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8 max-w-md">
        <div className="size-12 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertTriangle className="size-6" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            {t("error.failedToLoad")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {message || error?.message || t("error.unexpectedError")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-md text-sm font-medium transition-all"
        >
          <RefreshCw className="size-4" />
          {tCommon("tryAgain")}
        </button>
      </div>
    </div>
  );
}
