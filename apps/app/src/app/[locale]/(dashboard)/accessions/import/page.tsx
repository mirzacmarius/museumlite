"use client";

import {
  type FieldMapping,
  ImportFieldMapper,
} from "@/components/import-field-mapper";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { parseCSV } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

interface ParsedRow {
  accessionNumber?: string;
  dateReceived: string;
  source: string;
  method: string;
  cost?: string;
  notes?: string;
}

interface ImportState {
  step:
    | "upload"
    | "mapping"
    | "validation"
    | "preview"
    | "importing"
    | "complete";
  file: File | null;
  rawData: Record<string, string>[];
  sourceFields: string[];
  fieldMappings: FieldMapping[];
  rows: ParsedRow[];
  validationErrors: string[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

const REQUIRED_COLUMNS = ["dateReceived", "source", "method"];
const OPTIONAL_COLUMNS = ["accessionNumber", "cost", "notes"];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const TARGET_FIELDS = [
  {
    id: "dateReceived",
    label: "Date Received",
    required: true,
    description: "Date the item was received",
  },
  {
    id: "source",
    label: "Source",
    required: true,
    description: "Source or donor of the item",
  },
  {
    id: "method",
    label: "Method",
    required: true,
    description: "Acquisition method (purchase, donation, etc.)",
  },
  {
    id: "accessionNumber",
    label: "Accession Number",
    required: false,
    description: "Unique identifier (auto-generated if empty)",
  },
  {
    id: "cost",
    label: "Cost",
    required: false,
    description: "Acquisition cost",
  },
  {
    id: "notes",
    label: "Notes",
    required: false,
    description: "Additional notes",
  },
];

export default function ImportAccessionsPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("accessions");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({
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

  const createImportJob = useMutation(api.imports.createImportJob);
  const importBatch = useMutation(api.imports.importAccessionsBatch);

  const importJob = useQuery(
    api.imports.getImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

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
    [],
  );

  const handleSaveMappings = useCallback(
    (mappings: FieldMapping[]) => {
      setState((prev) => ({
        ...prev,
        fieldMappings: mappings,
        step: "validation",
      }));

      const mappingMap = new Map(
        mappings
          .filter((m) => m.targetField !== null)
          .map((m) => [m.targetField, m.sourceField]),
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
    [state.rawData],
  );

  const handleContinueAfterValidation = useCallback(() => {
    setState((prev) => ({ ...prev, step: "preview" }));
  }, []);

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

      const allErrors: string[] = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        if (!batch) continue;

        const result = await importBatch({
          organizationId: currentOrganizationId as Id<"organizations">,
          jobId,
          rows: batch,
          batchIndex: i,
        });

        allErrors.push(...result.errors);
      }

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
  }, [currentOrganizationId, state.rows, createImportJob, importBatch]);

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
  }, []);

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

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accessions">
                <ArrowLeft className="mr-2 size-4" />
                {t("backToAccessions")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("import.downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">{t("import.title")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("import.description")}
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) =>
                    e.key === "Enter" && fileInputRef.current?.click()
                  }
                  role="button"
                  tabIndex={0}
                  className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-muted/30"
                >
                  <Upload className="mb-4 size-10 text-muted-foreground" />
                  <p className="font-medium">{t("import.dropZone")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("import.maxRows")}
                  </p>
                </div>

                <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 font-medium">
                    {t("import.formatTitle")}
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      • <strong>{t("import.required")}</strong>{" "}
                      {t("import.requiredFields")}
                    </li>
                    <li>
                      • <strong>{t("import.optional")}</strong>{" "}
                      {t("import.optionalFields")}
                    </li>
                    <li>
                      • <strong>{t("import.methods")}</strong>{" "}
                      {t("import.methodsList")}
                    </li>
                    <li>
                      • <strong>{t("import.dateFormat")}</strong>{" "}
                      {t("import.dateFormatHint")}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {state.step === "mapping" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Map Fields</h2>
                    <p className="text-sm text-muted-foreground">
                      {state.rawData.length} rows from {state.file?.name}
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleReset}>
                    <X className="mr-2 size-4" />
                    {t("import.cancel")}
                  </Button>
                </div>

                <ImportFieldMapper
                  sourceFields={state.sourceFields}
                  targetFields={TARGET_FIELDS}
                  onSave={handleSaveMappings}
                />
              </div>
            )}

            {state.step === "validation" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Validation Report</h2>
                    <p className="text-sm text-muted-foreground">
                      {state.rows.length} valid rows,{" "}
                      {state.validationErrors.length} errors
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setState((prev) => ({ ...prev, step: "mapping" }))
                      }
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back to Mapping
                    </Button>
                    {state.rows.length > 0 && (
                      <Button
                        onClick={handleContinueAfterValidation}
                        className="bg-indigo-600 hover:bg-indigo-500"
                      >
                        Continue with {state.rows.length} Valid Rows
                      </Button>
                    )}
                  </div>
                </div>

                {state.validationErrors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {state.validationErrors.length} validation errors
                      </span>
                    </div>
                    <ul className="mt-2 max-h-96 space-y-1 overflow-auto text-sm text-destructive">
                      {Array.from(new Set(state.validationErrors)).map(
                        (error) => (
                          <li key={error}>{error}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {state.rows.length > 0 && (
                  <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="size-4" />
                      <span className="font-medium">
                        {state.rows.length} rows passed validation
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {state.step === "preview" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("import.previewTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("import.rowsReady", {
                        count: state.rows.length,
                        filename: state.file?.name ?? "",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setState((prev) => ({ ...prev, step: "validation" }))
                      }
                    >
                      <ArrowLeft className="mr-2 size-4" />
                      Back to Validation
                    </Button>
                    <PermissionGate permission="collections.create">
                      <Button
                        onClick={handleStartImport}
                        disabled={state.rows.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500"
                      >
                        <Upload className="mr-2 size-4" />
                        {t("import.importButton", { count: state.rows.length })}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>

                {state.validationErrors.length > 0 && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {state.validationErrors.length} rows were skipped due to
                        validation errors
                      </span>
                    </div>
                  </div>
                )}

                {state.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {t("import.validationErrors", {
                          count: state.errors.length,
                        })}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-destructive">
                      {state.errors.slice(0, 5).map((error) => (
                        <li key={error}>• {error}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>• ... and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          {t("import.tableHeaders.number")}
                        </TableHead>
                        <TableHead>
                          {t("import.tableHeaders.accession")}
                        </TableHead>
                        <TableHead>
                          {t("import.tableHeaders.dateReceived")}
                        </TableHead>
                        <TableHead>{t("import.tableHeaders.source")}</TableHead>
                        <TableHead>{t("import.tableHeaders.method")}</TableHead>
                        <TableHead>{t("import.tableHeaders.cost")}</TableHead>
                        <TableHead>{t("import.tableHeaders.notes")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.rows.slice(0, 20).map((row, rowIndex) => (
                        <TableRow
                          key={`${row.accessionNumber ?? rowIndex}-${row.dateReceived}-${row.source}`}
                        >
                          <TableCell className="text-muted-foreground">
                            {rowIndex + 1}
                          </TableCell>
                          <TableCell>
                            {row.accessionNumber || t("import.autoAccession")}
                          </TableCell>
                          <TableCell>{row.dateReceived}</TableCell>
                          <TableCell>{row.source}</TableCell>
                          <TableCell>{row.method}</TableCell>
                          <TableCell>{row.cost || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {row.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {state.rows.length > 20 && (
                    <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
                      {t("import.showingRows", { count: state.rows.length })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {state.step === "importing" && (
              <div className="mx-auto max-w-md text-center">
                <Loader2 className="mx-auto mb-4 size-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">
                  {t("import.importing")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {t("import.progress", {
                    current: importJob?.processedItems || 0,
                    total: importJob?.totalItems || state.rows.length,
                  })}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${importJob?.progress || 0}%` }}
                  />
                </div>
              </div>
            )}

            {state.step === "complete" && (
              <div className="mx-auto max-w-md text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
                <h2 className="text-xl font-semibold">
                  {t("import.complete")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {t("import.successMessage", {
                    count: importJob?.processedItems || state.rows.length,
                  })}
                </p>

                {state.errors.length > 0 && (
                  <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="size-4" />
                      <span className="font-medium">
                        {t("import.issuesMessage", {
                          count: state.errors.length,
                        })}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-amber-600">
                      {state.errors.slice(0, 5).map((error) => (
                        <li key={error}>• {error}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>• ... and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex justify-center gap-4">
                  <Button variant="outline" onClick={handleReset}>
                    {t("import.importMore")}
                  </Button>
                  <Button asChild className="bg-indigo-600 hover:bg-indigo-500">
                    <Link href="/accessions">{t("import.viewAccessions")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
