"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback } from "react";
import type { FieldMapping } from "@/components/import-field-mapper";
import { parseCsvTable, sha256Hex } from "@/lib/csv-parser";
import {
  EMPTY_IMPORT_STATE,
  type ImportState,
  MAX_IMPORT_ROWS,
  type ParsedRow,
} from "./import-accessions-types";

interface UseImportAccessionsOptions {
  currentOrganizationId: string | null;
  state: ImportState;
  setState: React.Dispatch<React.SetStateAction<ImportState>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const BATCH_SIZE = 50;

function readRawRows(text: string) {
  const table = parseCsvTable(text);
  if (table.records.length === 0) {
    throw new Error("CSV file has no data rows");
  }
  if (table.records.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `This file has ${table.records.length} rows. Split it into files of at most ${MAX_IMPORT_ROWS} rows.`,
    );
  }
  const rawData = table.records.map((record) => {
    const values: Record<string, string> = {};
    table.headers.forEach((header, index) => {
      if (header) values[header] = record.values[index] ?? "";
    });
    return { rowNumber: record.rowNumber, values };
  });
  return { headers: table.headers, rawData };
}

/**
 * Maps every source row. Rows missing required values are still sent so the
 * server records them as failed rows that can be downloaded and corrected.
 */
function mapRawRows(rawData: ImportState["rawData"], mappings: FieldMapping[]) {
  const mappingMap = new Map(
    mappings.flatMap((m) =>
      m.targetField === null ? [] : [[m.targetField, m.sourceField]],
    ),
  );
  const getValue = (values: Record<string, string>, field: string) =>
    values[mappingMap.get(field) || field] || undefined;

  const rows: ParsedRow[] = [];
  const validationErrors: string[] = [];
  for (const { rowNumber, values } of rawData) {
    const row: ParsedRow = {
      rowNumber,
      accessionNumber: getValue(values, "accessionNumber"),
      dateReceived: getValue(values, "dateReceived") ?? "",
      source: getValue(values, "source") ?? "",
      method: getValue(values, "method") ?? "",
      cost: getValue(values, "cost"),
      notes: getValue(values, "notes"),
    };
    const missing = (["dateReceived", "source", "method"] as const).filter(
      (field) => !row[field],
    );
    if (missing.length > 0) {
      validationErrors.push(
        `Row ${rowNumber}: Missing required fields: ${missing.join(", ")}`,
      );
    }
    rows.push(row);
  }
  return { rows, validationErrors };
}

type ImportRowResultsPage = FunctionReturnType<
  typeof api.imports.listImportRowResults
>;

export function useImportAccessions({
  currentOrganizationId,
  state,
  setState,
  fileInputRef,
}: UseImportAccessionsOptions) {
  const convex = useConvex();
  const createImportJob = useMutation(api.imports.createImportJob);
  const importBatch = useMutation(api.imports.importAccessionsBatch);
  const cancelImportJob = useMutation(api.imports.cancelImportJob);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      void (async () => {
        try {
          const text = await file.text();
          const { headers, rawData } = readRawRows(text);

          setState({
            ...EMPTY_IMPORT_STATE,
            step: "mapping",
            file,
            rawData,
            fingerprint: await sha256Hex(text),
            sourceFields: headers,
          });
        } catch (error) {
          setState({
            ...EMPTY_IMPORT_STATE,
            errors: [error instanceof Error ? error.message : "Invalid CSV"],
          });
        }
      })();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [fileInputRef, setState],
  );

  const handleSaveMappings = useCallback(
    (mappings: FieldMapping[]) => {
      const { rows, validationErrors } = mapRawRows(state.rawData, mappings);
      setState((prev) => ({
        ...prev,
        fieldMappings: mappings,
        rows,
        validationErrors,
        step: validationErrors.length > 0 ? "validation" : "preview",
      }));
    },
    [setState, state.rawData],
  );

  const handleContinueAfterValidation = useCallback(() => {
    setState((prev) => ({ ...prev, step: "preview" }));
  }, [setState]);

  const sendRows = useCallback(
    async (jobId: Id<"importJobs">, rows: ParsedRow[]) => {
      const organizationId = currentOrganizationId as Id<"organizations">;
      const errors: string[] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const result = await importBatch({
          organizationId,
          jobId,
          rows: rows.slice(i, i + BATCH_SIZE),
          batchIndex: Math.floor(i / BATCH_SIZE),
        });
        errors.push(...result.errors);
      }
      return errors;
    },
    [currentOrganizationId, importBatch],
  );

  /** Starts a new job, or resumes one for the same file (accepted rows are skipped). */
  const handleStartImport = useCallback(
    async (resumeJobId?: Id<"importJobs">) => {
      if (!currentOrganizationId || state.rows.length === 0) return;

      try {
        const jobId =
          resumeJobId ??
          (await createImportJob({
            organizationId: currentOrganizationId as Id<"organizations">,
            type: "csv",
            entityType: "accessions",
            totalItems: state.rows.length,
            sourceName: state.file?.name,
            sourceFingerprint: state.fingerprint ?? undefined,
          }));

        setState((prev) => ({ ...prev, step: "importing", jobId, errors: [] }));
        const errors = await sendRows(jobId, state.rows);
        setState((prev) => ({ ...prev, step: "complete", errors }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          step: prev.jobId ? "complete" : prev.step,
          errors: [
            ...prev.errors,
            err instanceof Error ? err.message : "Import failed",
          ],
        }));
      }
    },
    [
      currentOrganizationId,
      state.rows,
      state.file,
      state.fingerprint,
      createImportJob,
      sendRows,
      setState,
    ],
  );

  /** Re-attempts rows that failed, e.g. after a conflicting record was fixed. */
  const handleRetryFailed = useCallback(async () => {
    const jobId = state.jobId;
    if (!jobId) return;
    try {
      const failedRows = new Set<number>();
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
        for (const row of page.page) failedRows.add(row.rowNumber);
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
      setState((prev) => ({ ...prev, step: "importing", errors: [] }));
      const errors = await sendRows(
        jobId,
        state.rows.filter((row) => failedRows.has(row.rowNumber)),
      );
      setState((prev) => ({ ...prev, step: "complete", errors }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        step: "complete",
        errors: [err instanceof Error ? err.message : "Retry failed"],
      }));
    }
  }, [convex, sendRows, setState, state.jobId, state.rows]);

  /**
   * Continues the same job with an edited copy of the file. Row positions must
   * be unchanged so each correction lands on its original source row.
   */
  const handleUploadCorrection = useCallback(
    async (file: File) => {
      const jobId = state.jobId;
      if (!jobId) return;
      try {
        const text = await file.text();
        const { rawData } = readRawRows(text);
        const sameRows =
          rawData.length === state.rawData.length &&
          rawData.every(
            (row, index) => row.rowNumber === state.rawData[index]?.rowNumber,
          );
        if (!sameRows) {
          throw new Error(
            "The corrected file must keep the same rows in the same order. Fix values in place without adding, removing or reordering rows.",
          );
        }
        const { rows, validationErrors } = mapRawRows(
          rawData,
          state.fieldMappings,
        );
        setState((prev) => ({
          ...prev,
          file,
          rawData,
          rows,
          validationErrors,
          fingerprint: null,
          step: "importing",
          errors: [],
        }));
        const errors = await sendRows(jobId, rows);
        setState((prev) => ({ ...prev, step: "complete", errors }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          step: "complete",
          errors: [err instanceof Error ? err.message : "Correction failed"],
        }));
      }
    },
    [sendRows, setState, state.fieldMappings, state.jobId, state.rawData],
  );

  const handleCancelImport = useCallback(async () => {
    if (!state.jobId) return;
    // The server refuses further batches; the running loop stops on its next call.
    await cancelImportJob({ jobId: state.jobId });
  }, [cancelImportJob, state.jobId]);

  const handleReset = useCallback(() => {
    setState(EMPTY_IMPORT_STATE);
  }, [setState]);

  const downloadTemplate = useCallback(() => {
    const headers = "accessionNumber,dateReceived,source,method,cost,notes";
    const example =
      '"ACC-001","2024-01-15","Private Collection","purchase","5000","Acquired at auction"';
    const csv = `${headers}\n${example}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "accession-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const onBackToMapping = useCallback(() => {
    setState((prev) => ({ ...prev, step: "mapping" }));
  }, [setState]);

  const onBackToValidation = useCallback(() => {
    setState((prev) => ({ ...prev, step: "validation" }));
  }, [setState]);

  return {
    handleFileSelect,
    handleSaveMappings,
    handleContinueAfterValidation,
    handleStartImport,
    handleRetryFailed,
    handleUploadCorrection,
    handleCancelImport,
    handleReset,
    downloadTemplate,
    onBackToMapping,
    onBackToValidation,
  };
}
