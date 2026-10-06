"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import type { FieldMapping } from "@/components/import-field-mapper";
import { useTrackedImportFlow } from "@/hooks/use-tracked-import-flow";
import { parseCsvObjects, sha256Hex } from "@/lib/csv-parser";
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

export function useImportAccessions({
  currentOrganizationId,
  state,
  setState,
  fileInputRef,
}: UseImportAccessionsOptions) {
  const importBatch = useMutation(api.imports.importAccessionsBatch);
  const run = useTrackedImportFlow<ParsedRow>({
    organizationId: currentOrganizationId,
    entityType: "accessions",
    sendBatch: importBatch,
    parseCorrection: (text) =>
      mapRawRows(
        parseCsvObjects(text, { maxRows: MAX_IMPORT_ROWS }).rows,
        state.fieldMappings,
      ).rows,
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      void (async () => {
        try {
          const text = await file.text();
          const { headers, rows } = parseCsvObjects(text, {
            maxRows: MAX_IMPORT_ROWS,
          });
          setState({
            ...EMPTY_IMPORT_STATE,
            step: "mapping",
            file,
            rawData: rows,
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

  /** Starts a new job, or resumes one for the same file (accepted rows are skipped). */
  const handleStartImport = useCallback(
    (resumeJobId?: Id<"importJobs">) =>
      run.start(state.rows, {
        sourceName: state.file?.name,
        fingerprint: state.fingerprint,
        resumeJobId,
      }),
    [run, state.file, state.fingerprint, state.rows],
  );

  const handleReset = useCallback(() => {
    run.reset();
    setState(EMPTY_IMPORT_STATE);
  }, [run, setState]);

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
    run,
    handleFileSelect,
    handleSaveMappings,
    handleContinueAfterValidation,
    handleStartImport,
    handleReset,
    downloadTemplate,
    onBackToMapping,
    onBackToValidation,
  };
}
