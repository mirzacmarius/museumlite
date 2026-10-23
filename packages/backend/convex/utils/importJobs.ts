import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { convexErrorData } from "./convexErrorData";
import { importRefusal } from "./importErrors";

export const MAX_IMPORT_BATCH_ROWS = 100;
export const MAX_IMPORT_TOTAL_ITEMS = 100_000;

export const importJobStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("completed_with_errors"),
  v.literal("cancelled"),
  v.literal("failed"),
);

export const importEntityTypeValidator = v.union(
  v.literal("objects"),
  v.literal("accessions"),
  v.literal("locations"),
  v.literal("accounts"),
  v.literal("loans"),
);

export type ImportEntityType = Doc<"importJobs">["entityType"] & string;

/** Entity types whose batch handlers persist per-row outcomes. */
export const ROW_TRACKED_ENTITY_TYPES: ReadonlySet<ImportEntityType> = new Set([
  "objects",
  "accessions",
  "locations",
  "accounts",
  "loans",
]);

export const importRowResultValidator = v.object({
  rowNumber: v.number(),
  status: v.union(v.literal("accepted"), v.literal("failed")),
  recordId: v.optional(v.string()),
  identifier: v.optional(v.string()),
  errors: v.array(v.string()),
  replayed: v.boolean(),
});

export type ImportRowResult = {
  rowNumber: number;
  status: "accepted" | "failed";
  recordId?: string;
  identifier?: string;
  errors: string[];
  replayed: boolean;
};

export const importJobViewFields = {
  _id: v.id("importJobs"),
  organizationId: v.id("organizations"),
  type: v.union(v.literal("csv"), v.literal("media")),
  entityType: v.optional(importEntityTypeValidator),
  status: importJobStatusValidator,
  progress: v.number(),
  totalItems: v.number(),
  processedItems: v.number(),
  attemptedItems: v.number(),
  acceptedItems: v.number(),
  failedItems: v.number(),
  sourceName: v.optional(v.string()),
  errors: v.optional(v.array(v.string())),
  createdAt: v.number(),
  finishedAt: v.optional(v.number()),
};

/** Legacy jobs only tracked accepted rows; their attempt counts are unknown. */
export function toImportJobView(job: Doc<"importJobs">) {
  const acceptedItems = job.acceptedItems ?? job.processedItems;
  return {
    _id: job._id,
    organizationId: job.organizationId,
    type: job.type,
    entityType: job.entityType,
    status: job.status,
    progress: Math.min(job.progress, 100),
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    attemptedItems: job.attemptedItems ?? acceptedItems,
    acceptedItems,
    failedItems: job.failedItems ?? 0,
    sourceName: job.sourceName,
    errors: job.errors,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}

export function validateImportJobTotal(totalItems: number) {
  if (
    !Number.isInteger(totalItems) ||
    totalItems < 1 ||
    totalItems > MAX_IMPORT_TOTAL_ITEMS
  ) {
    throw importRefusal("IMPORT_TOO_MANY_ROWS", {
      limit: MAX_IMPORT_TOTAL_ITEMS,
    });
  }
}

/** Loads a row-tracked job that can still accept rows for this entity type. */
export async function requireWritableImportJob(
  ctx: MutationCtx,
  jobId: Id<"importJobs">,
  organizationId: Id<"organizations">,
  entityType: ImportEntityType,
) {
  const job = await ctx.db.get(jobId);
  if (!job || job.organizationId !== organizationId || job.type !== "csv") {
    throw importRefusal("IMPORT_JOB_NOT_FOUND");
  }
  if (job.entityType !== undefined && job.entityType !== entityType) {
    throw importRefusal("IMPORT_JOB_WRONG_TYPE");
  }
  if (job.status === "cancelled") {
    throw importRefusal("IMPORT_JOB_CANCELLED");
  }
  if (job.status === "failed") {
    throw importRefusal("IMPORT_JOB_FAILED");
  }
  return job;
}

/**
 * Assigns each row its stable source row number. Rows without an explicit
 * number use the legacy position (50 rows per batch, header on line 1).
 */
export function resolveSourceRowNumbers<T extends { rowNumber?: number }>(
  rows: T[],
  batchIndex: number,
) {
  if (rows.length > MAX_IMPORT_BATCH_ROWS) {
    throw new Error(
      `Send at most ${MAX_IMPORT_BATCH_ROWS} rows per import batch`,
    );
  }
  const seen = new Set<number>();
  return rows.map((row, index) => {
    const rowNumber = row.rowNumber ?? batchIndex * 50 + index + 2;
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
      throw new Error("Each source row number must be a positive integer");
    }
    if (seen.has(rowNumber)) {
      throw new Error(`Duplicate source row ${rowNumber} in this batch`);
    }
    seen.add(rowNumber);
    return { row, rowNumber };
  });
}

export async function getStoredRowResult(
  ctx: MutationCtx,
  jobId: Id<"importJobs">,
  rowNumber: number,
) {
  return await ctx.db
    .query("importRowResults")
    .withIndex("by_job_and_rowNumber", (q) =>
      q.eq("jobId", jobId).eq("rowNumber", rowNumber),
    )
    .unique();
}

export function toRowResult(
  stored: Doc<"importRowResults">,
  replayed: boolean,
): ImportRowResult {
  return {
    rowNumber: stored.rowNumber,
    status: stored.status,
    recordId: stored.recordId,
    identifier: stored.identifier,
    errors: stored.errors,
    replayed,
  };
}

export interface CounterDelta {
  attempted: number;
  accepted: number;
  failed: number;
}

/** Persists one row attempt and returns its effect on the job counters. */
export async function storeRowOutcome(
  ctx: MutationCtx,
  job: Doc<"importJobs">,
  previous: Doc<"importRowResults"> | null,
  outcome: Omit<ImportRowResult, "replayed">,
): Promise<CounterDelta> {
  const now = Date.now();
  if (previous) {
    await ctx.db.patch(previous._id, {
      status: outcome.status,
      recordId: outcome.recordId,
      identifier: outcome.identifier,
      errors: outcome.errors,
      attempts: previous.attempts + 1,
      updatedAt: now,
    });
    // Only failed rows are re-attempted, so the row was already counted.
    return outcome.status === "accepted"
      ? { attempted: 0, accepted: 1, failed: -1 }
      : { attempted: 0, accepted: 0, failed: 0 };
  }
  await ctx.db.insert("importRowResults", {
    organizationId: job.organizationId,
    jobId: job._id,
    rowNumber: outcome.rowNumber,
    status: outcome.status,
    recordId: outcome.recordId,
    identifier: outcome.identifier,
    errors: outcome.errors,
    attempts: 1,
    updatedAt: now,
  });
  return outcome.status === "accepted"
    ? { attempted: 1, accepted: 1, failed: 0 }
    : { attempted: 1, accepted: 0, failed: 1 };
}

export async function applyImportJobProgress(
  ctx: MutationCtx,
  jobId: Id<"importJobs">,
  deltas: CounterDelta[],
  newErrors: string[],
  correctedRows: number[] = [],
) {
  // Re-read so counters reflect any batch committed before this one.
  const job = await ctx.db.get(jobId);
  if (!job) throw new Error("Import job not found");
  const sum = deltas.reduce(
    (total, delta) => ({
      attempted: total.attempted + delta.attempted,
      accepted: total.accepted + delta.accepted,
      failed: total.failed + delta.failed,
    }),
    { attempted: 0, accepted: 0, failed: 0 },
  );
  const view = toImportJobView(job);
  const attemptedItems = view.attemptedItems + sum.attempted;
  const acceptedItems = view.acceptedItems + sum.accepted;
  const failedItems = view.failedItems + sum.failed;
  const finished = attemptedItems >= job.totalItems;
  const now = Date.now();
  await ctx.db.patch(jobId, {
    attemptedItems,
    acceptedItems,
    failedItems,
    processedItems: acceptedItems,
    progress: Math.min(
      100,
      Math.round((attemptedItems / job.totalItems) * 100),
    ),
    errors: [
      ...(job.errors ?? []).filter(
        (error) =>
          !correctedRows.some((row) => error.startsWith(`Row ${row}:`)),
      ),
      ...newErrors,
    ].slice(-100),
    // Resolving an already-recorded item never reopens a cancelled job.
    status:
      job.status === "cancelled"
        ? "cancelled"
        : finished
          ? failedItems > 0
            ? "completed_with_errors"
            : "completed"
          : "processing",
    updatedAt: now,
    finishedAt:
      finished || job.status === "cancelled"
        ? (job.finishedAt ?? now)
        : undefined,
  });
}

/**
 * Runs one batch of a row-tracked import. Accepted rows replay their stored
 * result; new or previously failed rows run `importRow`, whose thrown error
 * message becomes the row's error. Rows run sequentially so identifiers and
 * names created by earlier rows are visible to later ones.
 */
export async function runTrackedImportBatch<Row extends { rowNumber?: number }>(
  ctx: MutationCtx,
  job: Doc<"importJobs">,
  rows: Row[],
  batchIndex: number,
  importRow: (
    row: Row,
    rowNumber: number,
  ) => Promise<{ recordId: string; identifier?: string }>,
) {
  const sourceRows = resolveSourceRowNumbers(rows, batchIndex);
  const previousResults = await Promise.all(
    sourceRows.map(({ rowNumber }) =>
      getStoredRowResult(ctx, job._id, rowNumber),
    ),
  );
  const finished = toImportJobView(job).attemptedItems >= job.totalItems;
  if (finished) {
    const unknown = sourceRows.find((_, index) => !previousResults[index]);
    if (unknown) {
      throw importRefusal("IMPORT_ROW_NOT_IN_IMPORT", {
        row: unknown.rowNumber,
      });
    }
  }

  const results: ImportRowResult[] = [];
  const deltas: CounterDelta[] = [];
  const correctedRows: number[] = [];
  for (const [index, { row, rowNumber }] of sourceRows.entries()) {
    const previous = previousResults[index] ?? null;
    if (previous?.status === "accepted") {
      results.push(toRowResult(previous, true));
      continue;
    }
    let outcome: Omit<ImportRowResult, "replayed">;
    try {
      const created = await importRow(row, rowNumber);
      outcome = {
        rowNumber,
        status: "accepted",
        recordId: created.recordId,
        identifier: created.identifier,
        errors: [],
      };
    } catch (error) {
      const data = convexErrorData(error);
      const message =
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : error instanceof Error
            ? error.message
            : "Unknown error";
      outcome = {
        rowNumber,
        status: "failed",
        errors: [
          message.startsWith(`Row ${rowNumber}:`)
            ? message
            : `Row ${rowNumber}: ${message}`,
        ],
      };
    }
    deltas.push(await storeRowOutcome(ctx, job, previous, outcome));
    if (previous && outcome.status === "accepted")
      correctedRows.push(rowNumber);
    results.push({ ...outcome, replayed: false });
  }

  const errors = results.flatMap((result) =>
    result.replayed ? [] : result.errors,
  );
  await applyImportJobProgress(ctx, job._id, deltas, errors, correctedRows);
  return {
    processed: results.filter(
      (result) => result.status === "accepted" && !result.replayed,
    ).length,
    errors,
    results,
  };
}
