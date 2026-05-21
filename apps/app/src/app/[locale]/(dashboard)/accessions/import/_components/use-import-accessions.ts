"use client";

import type { FieldMapping } from "@/components/import-field-mapper";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import type { ImportState, ParsedRow } from "./import-accessions-types";

interface UseImportAccessionsOptions {
  currentOrganizationId: string | null;
  state: ImportState;
  setState: React.Dispatch<React.SetStateAction<ImportState>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useImportAccessions({
  currentOrganizationId,
  state,
  setState,
  fileInputRef,
}: UseImportAccessionsOptions) {
  const createImportJob = useMutation(api.imports.createImportJob);
  const importBatch = useMutation(api.imports.importAccessionsBatch);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
          setState((prev) => ({
            ...prev,
            errors: ["CSV file is empty"],
          }));
          return;
        }

        const headerLine = lines[0];
        if (!headerLine) return;

        const headers = headerLine
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));

        const rawData: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          const values = line
            .split(",")
            .map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (header) {
              row[header] = values[j] || "";
            }
          }
          rawData.push(row);
        }

        setState({
          step: "mapping",
          file,
          rawData,
          sourceFields: headers,
          fieldMappings: [],
          rows: [],
          validationErrors: [],
          errors: [],
          jobId: null,
        });
      };
      reader.readAsText(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [fileInputRef, setState],
  );

  const handleSaveMappings = useCallback(
    (mappings: FieldMapping[]) => {
      setState((prev) => ({
        ...prev,
        fieldMappings: mappings,
        step: "validation",
      }));

      const mappingMap = new Map(
        mappings.flatMap((m) =>
          m.targetField === null ? [] : [[m.targetField, m.sourceField]],
        ),
      );

      const getValue = (field: string) => {
        const sourceField = mappingMap.get(field);
        return sourceField || field;
      };

      const parsedRows: ParsedRow[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < state.rawData.length; i++) {
        const rowData = state.rawData[i];
        if (!rowData) continue;

        try {
          const dateReceivedSource = getValue("dateReceived");
          const sourceSource = getValue("source");
          const methodSource = getValue("method");
          const accessionNumberSource = getValue("accessionNumber");
          const costSource = getValue("cost");
          const notesSource = getValue("notes");

          const dateReceived = rowData[dateReceivedSource];
          const source = rowData[sourceSource];
          const method = rowData[methodSource];

          if (!dateReceived || !source || !method) {
            const missing = [];
            if (!dateReceived) missing.push("dateReceived");
            if (!source) missing.push("source");
            if (!method) missing.push("method");
            validationErrors.push(
              `Row ${i + 1}: Missing required fields: ${missing.join(", ")}`,
            );
            continue;
          }

          parsedRows.push({
            accessionNumber: rowData[accessionNumberSource] || undefined,
            dateReceived,
            source,
            method,
            cost: rowData[costSource] || undefined,
            notes: rowData[notesSource] || undefined,
          });
        } catch (err) {
          validationErrors.push(
            `Row ${i + 1}: ${err instanceof Error ? err.message : "Parse error"}`,
          );
        }
      }

      setState((prev) => ({
        ...prev,
        rows: parsedRows,
        validationErrors,
        step: validationErrors.length > 0 ? "validation" : "preview",
      }));
    },
    [setState, state.rawData],
  );

  const handleContinueAfterValidation = useCallback(() => {
    setState((prev) => ({ ...prev, step: "preview" }));
  }, [setState]);

  const handleStartImport = useCallback(async () => {
    if (!currentOrganizationId || state.rows.length === 0) return;

    try {
      const jobId = await createImportJob({
        organizationId: currentOrganizationId as Id<"organizations">,
        type: "csv",
        totalItems: state.rows.length,
      });

      setState((prev) => ({ ...prev, step: "importing", jobId }));

      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < state.rows.length; i += BATCH_SIZE) {
        batches.push(state.rows.slice(i, i + BATCH_SIZE));
      }

      const results = await Promise.all(
        batches.map((batch, batchIndex) =>
          importBatch({
            organizationId: currentOrganizationId as Id<"organizations">,
            jobId,
            rows: batch,
            batchIndex,
          }),
        ),
      );
      const allErrors = results.flatMap((result) => result.errors);

      setState((prev) => ({
        ...prev,
        step: "complete",
        errors: [...prev.errors, ...allErrors],
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        errors: [
          ...prev.errors,
          err instanceof Error ? err.message : "Import failed",
        ],
      }));
    }
  }, [
    currentOrganizationId,
    state.rows,
    createImportJob,
    importBatch,
    setState,
  ]);

  const handleReset = useCallback(() => {
    setState({
      step: "upload",
      file: null,
      rawData: [],
      sourceFields: [],
      fieldMappings: [],
      rows: [],
      validationErrors: [],
      errors: [],
      jobId: null,
    });
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
    handleReset,
    downloadTemplate,
    onBackToMapping,
    onBackToValidation,
  };
}
