"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { History } from "lucide-react";
import type { ImportEntityType } from "@/hooks/use-tracked-import-runner";
import { useScopedI18n } from "@/locales/client";

interface ResumableImportNoticeProps {
  organizationId: string | null;
  entityType: ImportEntityType;
  fingerprint: string | null;
  rowCount: number;
  onResume: (jobId: Id<"importJobs">) => void;
}

/** Offers to continue an earlier, unfinished import of the same file. */
export function ResumableImportNotice({
  organizationId,
  entityType,
  fingerprint,
  rowCount,
  onResume,
}: ResumableImportNoticeProps) {
  const t = useScopedI18n("trackedImport");
  const job = useQuery(
    api.imports.findResumableImportJob,
    organizationId && fingerprint
      ? {
          organizationId: organizationId as Id<"organizations">,
          entityType,
          sourceFingerprint: fingerprint,
        }
      : "skip",
  );
  if (!job || job.totalItems !== rowCount) return null;

  return (
    <ResumableImportJobNotice
      message={t("resumeNotice", {
        date: new Date(job.createdAt).toLocaleString(),
        attempted: job.attemptedItems,
        total: job.totalItems,
        accepted: job.acceptedItems,
        failed: job.failedItems,
      })}
      onResume={() => onResume(job._id)}
    />
  );
}

/** Presentation of a resumable earlier import; callers supply the message. */
export function ResumableImportJobNotice({
  message,
  onResume,
}: {
  message: string;
  onResume: () => void;
}) {
  const t = useScopedI18n("trackedImport");
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 text-sm">
        <History className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>{message}</span>
      </div>
      <Button onClick={onResume}>{t("resumeImport")}</Button>
    </div>
  );
}
