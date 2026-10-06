"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FileImage } from "lucide-react";
import { TrackedImportOutcome } from "@/components/import/tracked-import-outcome";
import { TrackedImportProgress } from "@/components/import/tracked-import-progress";
import { useScopedI18n } from "@/locales/client";

interface MediaImportJobView {
  _id: Id<"importJobs">;
  status: string;
  progress: number;
  totalItems: number;
  attemptedItems: number;
  acceptedItems: number;
  failedItems: number;
}

function counts(job: MediaImportJobView | null | undefined, total: number) {
  return {
    attempted: job?.attemptedItems ?? 0,
    total: job?.totalItems ?? total,
    accepted: job?.acceptedItems ?? 0,
    failed: job?.failedItems ?? 0,
  };
}

export function MediaImportProgressStep({
  importJob,
  fileCount,
  onCancel,
}: {
  importJob: MediaImportJobView | null | undefined;
  fileCount: number;
  onCancel: () => Promise<void>;
}) {
  const t = useScopedI18n("collections");
  return (
    <div className="pt-12">
      <TrackedImportProgress
        importJob={importJob}
        fallbackTotal={fileCount}
        onCancel={onCancel}
        detail={t("mediaImport.progressDetail", counts(importJob, fileCount))}
      />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("mediaImport.doNotClose")}
      </p>
    </div>
  );
}

export function MediaImportOutcomeStep({
  importJob,
  unmappedFiles,
  fileCount,
  errors,
  onReset,
  onContinue,
  onReviewUnmapped,
}: {
  importJob: MediaImportJobView | null | undefined;
  unmappedFiles: number;
  fileCount: number;
  errors: string[];
  onReset: () => void;
  onContinue: () => Promise<void>;
  onReviewUnmapped: () => void;
}) {
  const t = useScopedI18n("collections");
  const cancelled = importJob?.status === "cancelled";
  return (
    <div className="pt-8">
      <TrackedImportOutcome
        importJob={importJob}
        errors={errors}
        fileName="media-import"
        viewHref="/collections"
        viewLabel={t("csvImport.viewCollections")}
        onReset={onReset}
        onRetryFailed={onContinue}
        onResume={onContinue}
        copy={{
          outcome: t("mediaImport.outcome", counts(importJob, fileCount)),
          resumeHint: t("mediaImport.resumeHint"),
          correctionHint: t("mediaImport.correctionHint"),
          downloadFailedRows: t("mediaImport.downloadFailedFiles"),
          retryFailedRows: t("mediaImport.retryFailedFiles"),
        }}
      >
        {unmappedFiles > 0 ? (
          <Button
            variant={cancelled ? "outline" : "default"}
            onClick={onReviewUnmapped}
          >
            <FileImage className="mr-2 size-4" />
            {t("mediaImport.reviewUnmapped", { count: unmappedFiles })}
          </Button>
        ) : null}
      </TrackedImportOutcome>
    </div>
  );
}
