"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { Progress } from "@v1/ui/progress";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useDownloadImportFailures } from "@/hooks/use-download-import-failures";
import { useScopedI18n } from "@/locales/client";

type ImportJob = FunctionReturnType<typeof api.imports.listImportJobs>[number];

interface DataImportJobsCardProps {
  importJobs: ImportJob[];
  /** Resolves with the reason, in the app's language, when the file is refused. */
  onUploadCorrection: (
    job: ImportJob,
    file: File,
  ) => Promise<string | undefined>;
}

const ACTIVE_STATUSES = new Set(["pending", "processing"]);

export function DataImportJobsCard({
  importJobs,
  onUploadCorrection,
}: DataImportJobsCardProps) {
  const t = useScopedI18n("settings.data.importJobs");
  const tSettings = useScopedI18n("untranslatedDashboard.settings");
  const correctionInputRef = useRef<HTMLInputElement>(null);
  const correctionJobRef = useRef<ImportJob | null>(null);
  const cancelImportJob = useMutation(api.imports.cancelImportJob);
  const downloadFailures = useDownloadImportFailures();
  const actionMessage = useActionErrorMessage();
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  if (importJobs.length === 0) {
    return null;
  }

  function statusLabel(status: ImportJob["status"]) {
    switch (status) {
      case "pending":
        return t("statusPending");
      case "processing":
        return t("statusProcessing");
      case "completed":
        return t("statusCompleted");
      case "completed_with_errors":
        return t("statusCompletedWithErrors");
      case "cancelled":
        return t("statusCancelled");
      default:
        return t("statusFailed");
    }
  }

  async function handleCancel(job: ImportJob) {
    setBusyJobId(job._id);
    try {
      await cancelImportJob({ jobId: job._id });
      toast.success(t("cancelled"));
    } catch (error) {
      toast.error(actionMessage(error, t("cancelFailed")));
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleDownload(job: ImportJob) {
    setBusyJobId(job._id);
    try {
      await downloadFailures(job._id, `import-${job._id}-failed-rows.csv`);
    } catch (error) {
      toast.error(actionMessage(error, t("downloadFailed")));
    } finally {
      setBusyJobId(null);
    }
  }

  async function handleCorrectionFile(file: File) {
    const job = correctionJobRef.current;
    if (!job) return;
    setBusyJobId(job._id);
    try {
      const refusal = await onUploadCorrection(job, file);
      if (refusal) toast.error(refusal);
    } catch (error) {
      toast.error(actionMessage(error, t("correctionFailed")));
    } finally {
      setBusyJobId(null);
      correctionJobRef.current = null;
    }
  }

  return (
    <Card>
      <input
        ref={correctionInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleCorrectionFile(file);
        }}
      />
      <CardHeader>
        <CardTitle>{tSettings("recentImportJobs")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {importJobs.map((job) => {
            const busy = busyJobId === job._id;
            return (
              <div
                key={job._id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  {job.status === "completed" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-green-500" />
                  ) : job.status === "cancelled" ? (
                    <Ban className="size-5 shrink-0 text-muted-foreground" />
                  ) : job.status === "failed" ||
                    job.status === "completed_with_errors" ? (
                    <AlertCircle className="size-5 shrink-0 text-amber-500" />
                  ) : (
                    <Loader2 className="size-5 shrink-0 animate-spin text-blue-500" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {job.sourceName ??
                        t("jobTitle", { type: job.entityType ?? job.type })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("counts", {
                        attempted: job.attemptedItems,
                        total: job.totalItems,
                        accepted: job.acceptedItems,
                        failed: job.failedItems,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Progress value={job.progress} className="w-32" />
                  <Badge
                    variant={
                      job.status === "completed"
                        ? "default"
                        : job.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {statusLabel(job.status)}
                  </Badge>
                  {job.failedItems > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleDownload(job)}
                    >
                      <Download className="mr-1 size-3" />
                      {t("downloadFailedRows")}
                    </Button>
                  )}
                  {job.failedItems > 0 &&
                    job.entityType &&
                    job.status !== "cancelled" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          correctionJobRef.current = job;
                          correctionInputRef.current?.click();
                        }}
                      >
                        <FileUp className="mr-1 size-3" />
                        {t("uploadCorrectedFile")}
                      </Button>
                    )}
                  {ACTIVE_STATUSES.has(job.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleCancel(job)}
                    >
                      {t("cancel")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
