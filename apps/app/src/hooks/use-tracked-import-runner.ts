"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback } from "react";

export type ImportEntityType =
  | "objects"
  | "accessions"
  | "locations"
  | "accounts"
  | "loans";

export interface TrackedImportRow {
  /** Line in the source file; the row's stable identity on its import job. */
  rowNumber: number;
}

type ImportRowResultsPage = FunctionReturnType<
  typeof api.imports.listImportRowResults
>;

const BATCH_SIZE = 50;

export class ImportCorrectionMismatchError extends Error {}

/**
 * Client side of a row-tracked import job: creates or resumes the job, sends
 * batches in order (the server replays rows it already accepted), finds failed
 * rows for retries and cancels.
 */
export function useTrackedImportRunner<Row extends TrackedImportRow>({
  organizationId,
  entityType,
  sendBatch,
}: {
  organizationId: string | null;
  entityType: ImportEntityType;
  sendBatch: (args: {
    organizationId: Id<"organizations">;
    jobId: Id<"importJobs">;
    rows: Row[];
    batchIndex: number;
  }) => Promise<{ errors: string[] }>;
}) {
  const convex = useConvex();
  const createImportJob = useMutation(api.imports.createImportJob);
  const cancelImportJob = useMutation(api.imports.cancelImportJob);

  const startJob = useCallback(
    async (source: {
      totalItems: number;
      sourceName?: string;
      fingerprint?: string | null;
      resumeJobId?: Id<"importJobs">;
    }) => {
      if (source.resumeJobId) return source.resumeJobId;
      if (!organizationId) throw new Error("Select an organization first");
      return await createImportJob({
        organizationId: organizationId as Id<"organizations">,
        type: "csv",
        entityType,
        totalItems: source.totalItems,
        sourceName: source.sourceName,
        sourceFingerprint: source.fingerprint ?? undefined,
      });
    },
    [createImportJob, entityType, organizationId],
  );

  const sendRows = useCallback(
    async (jobId: Id<"importJobs">, rows: Row[]) => {
      if (!organizationId) throw new Error("Select an organization first");
      const errors: string[] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const result = await sendBatch({
          organizationId: organizationId as Id<"organizations">,
          jobId,
          rows: rows.slice(i, i + BATCH_SIZE),
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        errors.push(...result.errors);
      }
      return errors;
    },
    [organizationId, sendBatch],
  );

  const failedRowNumbers = useCallback(
    async (jobId: Id<"importJobs">) => {
      const failed = new Set<number>();
      let cursor: string | null = null;
      for (;;) {
        const page: ImportRowResultsPage = await convex.query(
          api.imports.listImportRowResults,
          {
            jobId,
            status: "failed",
            paginationOpts: { numItems: 200, cursor },
          },
        );
        for (const row of page.page) failed.add(row.rowNumber);
        if (page.isDone) return failed;
        cursor = page.continueCursor;
      }
    },
    [convex],
  );

  const cancel = useCallback(
    async (jobId: Id<"importJobs">) => {
      await cancelImportJob({ jobId });
    },
    [cancelImportJob],
  );

  return { startJob, sendRows, failedRowNumbers, cancel };
}

/** A corrected file must keep every original source row in place. */
export function assertSameSourceRows(
  original: readonly TrackedImportRow[],
  corrected: readonly TrackedImportRow[],
) {
  const same =
    original.length === corrected.length &&
    corrected.every(
      (row, index) => row.rowNumber === original[index]?.rowNumber,
    );
  if (!same) throw new ImportCorrectionMismatchError();
}
