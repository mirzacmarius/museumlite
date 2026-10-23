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
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useDownloadImportFailures } from "@/hooks/use-download-import-failures";
import { useScopedI18n } from "@/locales/client";

interface TrackedImportOutcomeProps {
  importJob:
    | {
        _id: Id<"importJobs">;
        status: string;
        totalItems: number;
        attemptedItems: number;
        acceptedItems: number;
        failedItems: number;
      }
    | null
    | undefined;
  errors: string[];
  fileName?: string;
  viewHref: string;
  viewLabel: string;
  onReset: () => void;
  onRetryFailed: () => Promise<void>;
  /**
   * Resolves with the reason, in the app's language, when the corrected file
   * is refused before any row is sent. Omit when the import has no
   * corrected-file workflow (e.g. media files).
   */
  onUploadCorrection?: (file: File) => Promise<string | undefined>;
  /** Continues an interrupted import in place; shown only when unfinished. */
  onResume?: () => Promise<void>;
  /** Overrides for row-oriented copy, e.g. when items are files. */
  copy?: Partial<{
    outcome: string;
    resumeHint: string;
    correctionHint: string;
    downloadFailedRows: string;
    retryFailedRows: string;
  }>;
  /** Extra actions shown before the standard ones. */
  children?: ReactNode;
}

const EMPTY_COPY: NonNullable<TrackedImportOutcomeProps["copy"]> = {};

export function TrackedImportOutcome({
  importJob,
  errors,
  fileName,
  viewHref,
  viewLabel,
  onReset,
  onRetryFailed,
  onUploadCorrection,
  onResume,
  copy = EMPTY_COPY,
  children,
}: TrackedImportOutcomeProps) {
  const t = useScopedI18n("trackedImport");
  const downloadFailures = useDownloadImportFailures();
  const actionMessage = useActionErrorMessage();
  const correctionInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const failed = importJob?.failedItems ?? 0;
  const cancelled = importJob?.status === "cancelled";
  const unfinished =
    importJob !== null &&
    importJob !== undefined &&
    importJob.attemptedItems < importJob.totalItems;
  const attention = failed > 0 || unfinished;

  const Icon = cancelled ? Ban : attention ? AlertCircle : CheckCircle2;
  const iconClass = cancelled
    ? "text-muted-foreground"
    : attention
      ? "text-amber-500"
      : "text-green-500";

  /** Runs an action; a string it resolves with is a refusal to show. */
  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    try {
      const refusal = await action();
      if (typeof refusal === "string") toast.error(refusal);
    } catch (error) {
      toast.error(actionMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <Icon className={`mx-auto mb-4 size-12 ${iconClass}`} />
      <h2 className="text-xl font-semibold">
        {cancelled
          ? t("cancelledTitle")
          : unfinished
            ? t("interruptedTitle")
            : t("completeTitle")}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {copy.outcome ??
          t("outcome", {
            accepted: importJob?.acceptedItems ?? 0,
            failed,
            attempted: importJob?.attemptedItems ?? 0,
            total: importJob?.totalItems ?? 0,
          })}
      </p>
      {unfinished && !cancelled ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.resumeHint ?? t("resumeHint")}
        </p>
      ) : null}

      {errors.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("issues", { count: errors.length })}
            </span>
          </div>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm text-amber-600">
            {errors.map((error) => (
              <li key={error}>• {error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {failed > 0 && !cancelled ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {copy.correctionHint ?? t("correctionHint")}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {children}
        {unfinished && !cancelled && onResume ? (
          <Button
            disabled={busy}
            onClick={() => run(onResume, t("importFailed"))}
          >
            <RotateCcw className="mr-2 size-4" />
            {t("resumeImport")}
          </Button>
        ) : null}
        {failed > 0 && importJob ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await downloadFailures(
                  importJob._id,
                  `${fileName?.replace(/\.csv$/i, "") ?? "import"}-failed-rows.csv`,
                );
              }, t("downloadFailed"))
            }
          >
            <Download className="mr-2 size-4" />
            {copy.downloadFailedRows ?? t("downloadFailedRows")}
          </Button>
        ) : null}
        {failed > 0 && !cancelled && onUploadCorrection ? (
          <>
            <input
              ref={correctionInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) {
                  void run(
                    () => onUploadCorrection(file),
                    t("correctionFailed"),
                  );
                }
              }}
            />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => correctionInputRef.current?.click()}
            >
              <FileUp className="mr-2 size-4" />
              {t("uploadCorrectedFile")}
            </Button>
          </>
        ) : null}
        {failed > 0 && !cancelled ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(onRetryFailed, t("retryFailed"))}
          >
            <RotateCcw className="mr-2 size-4" />
            {copy.retryFailedRows ?? t("retryFailedRows")}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onReset}>
          {t("importMore")}
        </Button>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href={viewHref}>{viewLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
