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
  name: string;
  type: string;
  parentLocation?: string;
  address?: string;
  capacity?: string;
  notes?: string;
}

interface ImportState {
  step: "upload" | "preview" | "importing" | "complete";
  file: File | null;
  rows: ParsedRow[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

const REQUIRED_COLUMNS = ["name", "type"];
const OPTIONAL_COLUMNS = ["parentLocation", "address", "capacity", "notes"];
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

    const name = getValue("name");
    const type = getValue("type");

    if (!name) {
      errors.push(`Row ${i + 1}: Name is required`);
      continue;
    }

    if (!type) {
      errors.push(`Row ${i + 1}: Type is required`);
      continue;
    }

    rows.push({
      name,
      type,
      parentLocation: getValue("parentLocation") || undefined,
      address: getValue("address") || undefined,
      capacity: getValue("capacity") || undefined,
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

export default function ImportLocationsPage() {
  const t = useScopedI18n("locations");
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({
    step: "upload",
    file: null,
    rows: [],
    errors: [],
    jobId: null,
  });

  const createImportJob = useMutation(api.imports.createImportJob);
  const importBatch = useMutation(api.imports.importLocationsBatch);

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
    const headers = "name,type,parentLocation,address,capacity,notes";
    const example =
      '"Main Gallery","gallery","","123 Museum Ave","100","Primary exhibition space"';
    const csv = `${headers}\n${example}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "location-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationToImport")}
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
              <Link href="/locations">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToLocations")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              {t("downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">{t("importTitle")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("importDescription")}
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
                  <p className="font-medium">{t("dropCSVHere")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("maxRows")}
                  </p>
                </div>

                <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 font-medium">
                    {t("csvFormatRequirements")}
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      <strong>{t("requiredColumns")}:</strong> name, type
                    </li>
                    <li>
                      <strong>{t("optionalColumns")}:</strong> parentLocation,
                      address, capacity, notes
                    </li>
                    <li>
                      <strong>{t("types")}:</strong> building, floor, room,
                      gallery, storage, cabinet, shelf, drawer
                    </li>
                    <li>
                      <strong>{t("parentReference")}:</strong>{" "}
                      {t("parentReferenceDescription")}
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
                      {t("previewImport")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("rowsReadyToImport", {
                        count: state.rows.length.toString(),
                        filename: state.file?.name || "",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset}>
                      <X className="mr-2 h-4 w-4" />
                      {t("cancel")}
                    </Button>
                    <PermissionGate permission="locations.create">
                      <Button
                        onClick={handleStartImport}
                        disabled={state.rows.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {t("importLocations", {
                          count: state.rows.length.toString(),
                        })}
                      </Button>
                    </PermissionGate>
                  </div>
                </div>

                {state.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">
                        {t("validationErrors", {
                          count: state.errors.length.toString(),
                        })}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-destructive">
                      {state.errors.slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>... and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Parent Location</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.rows.slice(0, 20).map((row, rowIndex) => (
                        <TableRow key={`${row.name}-${rowIndex}`}>
                          <TableCell className="text-muted-foreground">
                            {rowIndex + 1}
                          </TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell>{row.parentLocation || "-"}</TableCell>
                          <TableCell>{row.address || "-"}</TableCell>
                          <TableCell>{row.capacity || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {row.notes || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {state.rows.length > 20 && (
                    <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
                      Showing 20 of {state.rows.length} rows
                    </div>
                  )}
                </div>
              </div>
            )}

            {state.step === "importing" && (
              <div className="mx-auto max-w-md text-center">
                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold">
                  {t("importingLocations")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {t("processedCount", {
                    current: (importJob?.processedItems || 0).toString(),
                    total: (
                      importJob?.totalItems || state.rows.length
                    ).toString(),
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
                <h2 className="text-xl font-semibold">{t("importComplete")}</h2>
                <p className="mt-2 text-muted-foreground">
                  {t("successfullyImported", {
                    count: (
                      importJob?.processedItems || state.rows.length
                    ).toString(),
                  })}
                </p>

                {state.errors.length > 0 && (
                  <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">
                        {t("rowsHadIssues", {
                          count: state.errors.length.toString(),
                        })}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm text-amber-600">
                      {state.errors.slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                      {state.errors.length > 5 && (
                        <li>... and {state.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex justify-center gap-4">
                  <Button variant="outline" onClick={handleReset}>
                    {t("importMore")}
                  </Button>
                  <Button asChild className="bg-indigo-600 hover:bg-indigo-500">
                    <Link href="/locations">{t("viewLocations")}</Link>
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
