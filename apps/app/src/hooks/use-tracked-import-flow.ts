"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useCsvFileProblemMessage } from "@/hooks/use-csv-file-problem-message";
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
 * edited copy of the file into rows using the page's own column rules, or
 * returns why the file is refused, in the app's language. It may also throw a
 * `CsvFileError`.
 */
export function useTrackedImportFlow<Row extends TrackedImportRow>(options: {
  organizationId: string | null;
  entityType: ImportEntityType;
  sendBatch: Parameters<typeof useTrackedImportRunner<Row>>[0]["sendBatch"];
  parseCorrection: (text: string) => Row[] | string;
}) {
  const t = useScopedI18n("trackedImport");
  const actionMessage = useActionErrorMessage();
  const csvMessage = useCsvFileProblemMessage();
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
          errors: [actionMessage(error, t("importFailed"))],
          sentRows: sourceRows,
        });
      }
    },
    [actionMessage, runner, t],
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
          errors: [actionMessage(error, t("importFailed"))],
        }));
      }
    },
    [actionMessage, runner, send, t],
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

  /** Resolves with the reason when the corrected file is refused. */
  const uploadCorrection = useCallback(
    async (file: File): Promise<string | undefined> => {
      if (!run.jobId) return;
      const text = await file.text();
      let corrected: Row[] | string;
      try {
        corrected = options.parseCorrection(text);
      } catch (error) {
        const refusal = csvMessage(error);
        if (refusal) return refusal;
        throw error;
      }
      if (typeof corrected === "string") return corrected;
      try {
        assertSameSourceRows(run.sentRows, corrected);
      } catch (error) {
        if (error instanceof ImportCorrectionMismatchError) {
          return t("correctionMismatch");
        }
        throw error;
      }
      await send(run.jobId, corrected);
    },
    [csvMessage, options, run.jobId, run.sentRows, send, t],
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
