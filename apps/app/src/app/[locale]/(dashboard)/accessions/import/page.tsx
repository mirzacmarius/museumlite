"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { useCallback, useRef, useState } from "react";

interface ParsedRow {
  accessionNumber?: string;
  dateReceived: string;
  source: string;
  method: string;
  cost?: string;
  notes?: string;
}

interface ImportState {
  step: "upload" | "preview" | "importing" | "complete";
  file: File | null;
  rows: ParsedRow[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

const REQUIRED_COLUMNS = ["dateReceived", "source", "method"];
const OPTIONAL_COLUMNS = ["accessionNumber", "cost", "notes"];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return {
      rows: [],
      errors: ["CSV must have a header row and at least one data row"],
    };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return { rows: [], errors: ["Missing header row"] };
  }

  const headers = headerLine
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  const missingRequired = REQUIRED_COLUMNS.filter(
    (col) => !headers.some((h) => h.toLowerCase() === col.toLowerCase()),
  );

  if (missingRequired.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingRequired.join(", ")}`],
    };
  }

  const columnMap = new Map<string, number>();
  for (const col of ALL_COLUMNS) {
    const idx = headers.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (idx !== -1) {
      columnMap.set(col, idx);
    }
  }

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const values = parseCSVLine(line);

    const getValue = (col: string): string => {
      const idx = columnMap.get(col);
      if (idx === undefined) return "";
      return (values[idx] || "").trim();
    };

    const source = getValue("source");
    if (!source) {
      errors.push(`Row ${i + 1}: Source is required`);
      continue;
    }

    rows.push({
      accessionNumber: getValue("accessionNumber") || undefined,
      dateReceived: getValue("dateReceived") || new Date().toISOString(),
      source,
      method: getValue("method") || "other",
      cost: getValue("cost") || undefined,
      notes: getValue("notes") || undefined,
    });
  }

  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export default function ImportAccessionsPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("accessions");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({
    step: "upload",
    file: null,
    rows: [],
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
        const { rows, errors } = parseCSV(text);

        setState({
          step: "preview",
          file,
          rows,
          errors,
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
      rows: [],
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
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accessions">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToAccessions")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              {t("import.downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
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
                  <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
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
                    <Button variant="outline" onClick={handleReset}>
                      <X className="mr-2 h-4 w-4" />
                      {t("import.cancel")}
                    </Button>
                    <PermissionGate permission="collections.create">
                      <Button
                        onClick={handleStartImport}
                        disabled={state.rows.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {t("import.importButton", { count: state.rows.length })}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>

                {state.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
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
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
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
                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
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
                      <AlertCircle className="h-4 w-4" />
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
