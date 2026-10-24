"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import type { FieldMapping } from "@/components/import-field-mapper";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useCsvFileProblemMessage } from "@/hooks/use-csv-file-problem-message";
import { useTrackedImportFlow } from "@/hooks/use-tracked-import-flow";
import { parseCsvObjects, sha256Hex } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import {
  EMPTY_IMPORT_STATE,
  IMPORT_TEMPLATES,
  type ImportState,
  MAX_IMPORT_ROWS,
  OBJECT_IMPORT_TEMPLATE_CSV,
  OPTIONAL_COLUMNS,
  type ParsedRow,
} from "./import-objects-types";

interface UseImportObjectsOptions {
  currentOrganizationId: string | null;
  state: ImportState;
  setState: React.Dispatch<React.SetStateAction<ImportState>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Maps every source row. Rows without a title are still sent so the server
 * records them as failed rows that can be downloaded and corrected.
 */
export function mapRawRows(
  rawData: ImportState["rawData"],
  mappings: FieldMapping[],
) {
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
      title: getValue(values, "title") ?? "",
    };
    for (const field of OPTIONAL_COLUMNS) {
      row[field] = getValue(values, field);
    }
    if (!row.title) {
      validationErrors.push(`Row ${rowNumber}: Title is required`);
    }
    rows.push(row);
  }
  return { rows, validationErrors };
}

export function useImportObjects({
  currentOrganizationId,
  state,
  setState,
  fileInputRef,
}: UseImportObjectsOptions) {
  const importBatch = useMutation(api.imports.importObjectsBatch);
  const t = useScopedI18n("trackedImport");
  const actionMessage = useActionErrorMessage();
  const csvMessage = useCsvFileProblemMessage();
  const run = useTrackedImportFlow<ParsedRow>({
    organizationId: currentOrganizationId,
    entityType: "objects",
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
            errors: [
              csvMessage(error) ?? actionMessage(error, t("importFailed")),
            ],
          });
        }
      })();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [actionMessage, csvMessage, fileInputRef, setState, t],
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

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      setState((prev) => ({
        ...prev,
        selectedTemplate: templateId === "" ? null : templateId,
      }));
    },
    [setState],
  );

  const getInitialMappings = useCallback((): FieldMapping[] | undefined => {
    if (!state.selectedTemplate) {
      return undefined;
    }

    const template = IMPORT_TEMPLATES.find(
      (item) => item.id === state.selectedTemplate,
    );
    if (!template) {
      return undefined;
    }

    return state.sourceFields.map((sourceField) => {
      const targetField = template.mappings[sourceField] || null;
      return {
        sourceField,
        targetField,
      };
    });
  }, [state.selectedTemplate, state.sourceFields]);

  const handleReset = useCallback(() => {
    run.reset();
    setState(EMPTY_IMPORT_STATE);
  }, [run, setState]);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([OBJECT_IMPORT_TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "object-import-template.csv";
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
    handleTemplateSelect,
    getInitialMappings,
    handleReset,
    downloadTemplate,
    onBackToMapping,
    onBackToValidation,
  };
}
