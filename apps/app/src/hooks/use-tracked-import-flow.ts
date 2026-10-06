"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { useScopedI18n } from "@/locales/client";
import {
  assertSameSourceRows,
  ImportCorrectionMismatchError,
  type ImportEntityType,
  type TrackedImportRow,
  useTrackedImportRunner,
} from "./use-tracked-import-runner";

interface TrackedImportRun<Row> {
  jobId: Id<"importJobs"> | null;
  phase: "idle" | "importing" | "complete";
  errors: string[];
  /** Rows last sent to the job, in source order. */
  sentRows: Row[];
}

/**
 * Import run state shared by the CSV import pages. `parseCorrection` turns an
 * edited copy of the file into rows using the page's own column rules.
 */
export function useTrackedImportFlow<Row extends TrackedImportRow>(options: {
  organizationId: string | null;
  entityType: ImportEntityType;
  sendBatch: Parameters<typeof useTrackedImportRunner<Row>>[0]["sendBatch"];
  parseCorrection: (text: string) => Row[];
}) {
  const t = useScopedI18n("trackedImport");
  const runner = useTrackedImportRunner<Row>(options);
  const [run, setRun] = useState<TrackedImportRun<Row>>({
    jobId: null,
    phase: "idle",
    errors: [],
    sentRows: [],
  });
  const importJob = useQuery(
    api.imports.getImportJob,
    run.jobId ? { jobId: run.jobId } : "skip",
  );

  /** Sends `rows`; `sourceRows` is the full file kept for later corrections. */
  const send = useCallback(
    async (jobId: Id<"importJobs">, rows: Row[], sourceRows: Row[] = rows) => {
      setRun({ jobId, phase: "importing", errors: [], sentRows: sourceRows });
      try {
        const errors = await runner.sendRows(jobId, rows);
        setRun({ jobId, phase: "complete", errors, sentRows: sourceRows });
      } catch (error) {
        setRun({
          jobId,
          phase: "complete",
          errors: [error instanceof Error ? error.message : t("importFailed")],
          sentRows: sourceRows,
        });
      }
    },
    [runner, t],
  );

  const start = useCallback(
    async (
      rows: Row[],
      source: {
        sourceName?: string;
        fingerprint?: string | null;
        resumeJobId?: Id<"importJobs">;
      },
    ) => {
      try {
        const jobId = await runner.startJob({
          ...source,
          totalItems: rows.length,
        });
        await send(jobId, rows);
      } catch (error) {
        setRun((prev) => ({
          ...prev,
          errors: [error instanceof Error ? error.message : t("importFailed")],
        }));
      }
    },
    [runner, send, t],
  );

  const retryFailed = useCallback(async () => {
    if (!run.jobId) return;
    const failed = await runner.failedRowNumbers(run.jobId);
    await send(
      run.jobId,
      run.sentRows.filter((row) => failed.has(row.rowNumber)),
      run.sentRows,
    );
  }, [run.jobId, run.sentRows, runner, send]);

  const uploadCorrection = useCallback(
    async (file: File) => {
      if (!run.jobId) return;
      const corrected = options.parseCorrection(await file.text());
      try {
        assertSameSourceRows(run.sentRows, corrected);
      } catch (error) {
        if (error instanceof ImportCorrectionMismatchError) {
          throw new Error(t("correctionMismatch"));
        }
        throw error;
      }
      await send(run.jobId, corrected);
    },
    [options, run.jobId, run.sentRows, send, t],
  );

  const cancel = useCallback(async () => {
    if (run.jobId) await runner.cancel(run.jobId);
  }, [run.jobId, runner]);

  const reset = useCallback(() => {
    setRun({ jobId: null, phase: "idle", errors: [], sentRows: [] });
  }, []);

  return {
    ...run,
    importJob,
    jobUnavailable: run.jobId !== null && importJob === null,
    start,
    retryFailed,
    uploadCorrection,
    cancel,
    reset,
  };
}
