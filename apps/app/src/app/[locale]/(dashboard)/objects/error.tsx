"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { useI18n } from "@/locales/client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ObjectsError({ error, reset }: ErrorProps) {
  const tRoot = useI18n();
  useEffect(() => {
    console.error("Objects error:", error);
  }, [error]);

  return (
    <div className="flex size-full items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-card p-8 max-w-md text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-8 text-destructive" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {tRoot("untranslatedRecords.common.failedToLoadObjects")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tRoot("untranslatedRecords.common.failedToLoadObjectsDescription")}
          </p>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            {tRoot("untranslatedRecords.common.errorId")} {error.digest}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 size-4" />
              {tRoot("untranslatedRecords.common.dashboard")}
            </Link>
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="mr-2 size-4" />
            {tRoot("untranslatedRecords.common.tryAgain")}
          </Button>
        </div>
      </div>
    </div>
  );
}
