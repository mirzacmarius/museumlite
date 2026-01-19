"use client";

import { useScopedI18n } from "@/locales/client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface AccessionsErrorProps {
  error?: Error;
  message?: string;
}

export function AccessionsError({ error, message }: AccessionsErrorProps) {
  const router = useRouter();
  const t = useScopedI18n("accessions");
  const tCommon = useScopedI18n("common");

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8 max-w-md">
        <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
          <AlertTriangle className="h-6 w-6" />
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
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-md text-sm font-medium transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          {tCommon("tryAgain")}
        </button>
      </div>
    </div>
  );
}
