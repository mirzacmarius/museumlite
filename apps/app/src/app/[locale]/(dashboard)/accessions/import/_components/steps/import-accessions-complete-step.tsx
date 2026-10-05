"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Download,
  FileUp,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useDownloadImportFailures } from "@/hooks/use-download-import-failures";
import type { ImportState } from "../import-accessions-types";

interface ImportJobResult {
  _id: Id<"importJobs">;
  status: string;
  totalItems: number;
  attemptedItems: number;
  acceptedItems: number;
  failedItems: number;
}

interface ImportAccessionsCompleteStepProps {
  state: ImportState;
  importJob: ImportJobResult | null | undefined;
  t: (key: string, params?: Record<string, string | number>) => string;
  onReset: () => void;
  onRetryFailed: () => Promise<void>;
  onUploadCorrection: (file: File) => Promise<void>;
}

export function ImportAccessionsCompleteStep({
  state,
  importJob,
  t,
  onReset,
  onRetryFailed,
  onUploadCorrection,
}: ImportAccessionsCompleteStepProps) {
  const correctionInputRef = useRef<HTMLInputElement>(null);
  const downloadFailures = useDownloadImportFailures();
  const [busy, setBusy] = useState(false);
  const failed = importJob?.failedItems ?? 0;
  const cancelled = importJob?.status === "cancelled";
  const unfinished =
    importJob !== null &&
    importJob !== undefined &&
    importJob.attemptedItems < importJob.totalItems;

  const Icon = cancelled
    ? Ban
    : failed > 0 || unfinished
      ? AlertCircle
      : CheckCircle2;
  const iconClass = cancelled
    ? "text-muted-foreground"
    : failed > 0 || unfinished
      ? "text-amber-500"
      : "text-green-500";

  return (
    <div className="mx-auto max-w-lg text-center">
      <Icon className={`mx-auto mb-4 size-12 ${iconClass}`} />
      <h2 className="text-xl font-semibold">
        {cancelled
          ? t("import.cancelledTitle")
          : unfinished
            ? t("import.interruptedTitle")
            : t("import.complete")}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {t("import.outcome", {
          accepted: importJob?.acceptedItems ?? 0,
          failed,
          attempted: importJob?.attemptedItems ?? 0,
          total: importJob?.totalItems ?? state.rows.length,
        })}
      </p>
      {unfinished && !cancelled ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("import.resumeHint")}
        </p>
      ) : null}

      {state.errors.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("import.issuesMessage", { count: state.errors.length })}
            </span>
          </div>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm text-amber-600">
            {state.errors.map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {failed > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("import.correctionHint")}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {failed > 0 && importJob ? (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadFailures(
                    importJob._id,
                    `${state.file?.name.replace(/\.csv$/i, "") ?? "accessions"}-failed-rows.csv`,
                  );
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t("import.downloadFailed"),
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download className="mr-2 size-4" />
              {t("import.downloadFailedRows")}
            </Button>
            {!cancelled ? (
              <>
                <input
                  ref={correctionInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    try {
                      await onUploadCorrection(file);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => correctionInputRef.current?.click()}
                >
                  <FileUp className="mr-2 size-4" />
                  {t("import.uploadCorrectedFile")}
                </Button>
              </>
            ) : null}
            {!cancelled ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onRetryFailed();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RotateCcw className="mr-2 size-4" />
                {t("import.retryFailedRows")}
              </Button>
            ) : null}
          </>
        ) : null}
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
