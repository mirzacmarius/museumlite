"use client";

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
import { useCallback, useRef, useState } from "react";

interface ParsedRow {
  accessionNumber?: string;
  title: string;
  alternativeTitle?: string;
  creator?: string;
  objectType?: string;
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string;
  technique?: string;
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  location?: string;
  collectionGroup?: string;
}

interface ImportState {
  step: "upload" | "preview" | "importing" | "complete";
  file: File | null;
  rows: ParsedRow[];
  errors: string[];
  jobId: Id<"importJobs"> | null;
}

const REQUIRED_COLUMNS = ["title"];
const OPTIONAL_COLUMNS = [
  "accessionNumber",
  "alternativeTitle",
  "creator",
  "objectType",
  "objectName",
  "culture",
  "period",
  "dateCreated",
  "materials",
  "technique",
  "dimensions",
  "description",
  "condition",
  "provenance",
  "location",
  "collectionGroup",
];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export default function ImportObjectsPage() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
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
  const importBatch = useMutation(api.imports.importObjectsBatch);

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
        const { rows, errors } = parseCSV<ParsedRow>({
          text,
          requiredColumns: REQUIRED_COLUMNS,
          allColumns: ALL_COLUMNS,
          mapRow: (getValue, rowIndex) => {
            const title = getValue("title");

            if (!title) {
              throw new Error(`Row ${rowIndex}: Title is required`);
            }

            return {
              accessionNumber: getValue("accessionNumber") || undefined,
              title,
              alternativeTitle: getValue("alternativeTitle") || undefined,
              creator: getValue("creator") || undefined,
              objectType: getValue("objectType") || undefined,
              objectName: getValue("objectName") || undefined,
              culture: getValue("culture") || undefined,
              period: getValue("period") || undefined,
              dateCreated: getValue("dateCreated") || undefined,
              materials: getValue("materials") || undefined,
              technique: getValue("technique") || undefined,
              dimensions: getValue("dimensions") || undefined,
              description: getValue("description") || undefined,
              condition: getValue("condition") || undefined,
              provenance: getValue("provenance") || undefined,
              location: getValue("location") || undefined,
              collectionGroup: getValue("collectionGroup") || undefined,
            };
          },
        });

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
    const headers =
      "title,accessionNumber,creator,objectType,culture,period,dateCreated,materials,dimensions,condition,location,collectionGroup";
    const example =
      '"Portrait of a Lady","2024.001","Unknown Artist","painting","European","19th Century","c. 1850","Oil on canvas","24 x 18 inches","Good","Main Gallery","European Art"';
    const csv = `${headers}\n${example}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "object-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationImport")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/collections">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToCollections")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              {t("csvImport.downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <div className="mx-auto max-w-2xl">
                <div className="mb-8 text-center">
                  <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">
                    {t("csvImport.title")}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("csvImport.description")}
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
                  <p className="font-medium">{t("csvImport.dropZone")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("csvImport.maxRows")}
                  </p>
                </div>

                <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 font-medium">
                    {t("csvImport.formatTitle")}
                  </h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      <strong>Required:</strong> title
                    </li>
                    <li>
                      <strong>Identification:</strong> accessionNumber, creator,
                      objectType, objectName
                    </li>
                    <li>
                      <strong>Context:</strong> culture, period, dateCreated
                    </li>
                    <li>
                      <strong>Physical:</strong> materials, technique,
                      dimensions, condition
                    </li>
                    <li>
                      <strong>Organization:</strong> location (by name),
                      collectionGroup (by name)
                    </li>
                    <li>
                      <strong>Documentation:</strong> description, provenance
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
                      {t("csvImport.previewTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {state.rows.length} rows ready to import from{" "}
                      {state.file?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset}>
                      <X className="mr-2 h-4 w-4" />
                      {common("cancel")}
                    </Button>
                    <PermissionGate permission="collections.create">
                      <Button
                        onClick={handleStartImport}
                        disabled={state.rows.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Import {state.rows.length} Objects
                      </Button>
                    </PermissionGate>
                  </div>
                </div>

                {state.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">
                        {state.errors.length} validation errors
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
                        <TableHead>Accession #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.rows.slice(0, 20).map((row, rowIndex) => (
                        <TableRow key={`${row.title}-${rowIndex}`}>
                          <TableCell className="text-muted-foreground">
                            {rowIndex + 1}
                          </TableCell>
                          <TableCell>
                            {row.accessionNumber || "(auto)"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {row.title}
                          </TableCell>
                          <TableCell>{row.creator || "-"}</TableCell>
                          <TableCell>{row.objectType || "-"}</TableCell>
                          <TableCell>{row.period || "-"}</TableCell>
                          <TableCell>{row.location || "-"}</TableCell>
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
                  {t("csvImport.importing")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {importJob?.processedItems || 0} of{" "}
                  {importJob?.totalItems || state.rows.length} processed
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
                  {t("csvImport.complete")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Successfully imported{" "}
                  {importJob?.processedItems || state.rows.length} objects
                </p>

                {state.errors.length > 0 && (
                  <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-left">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">
                        {state.errors.length} rows had issues
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
                    {t("csvImport.importMore")}
                  </Button>
                  <Button asChild className="bg-indigo-600 hover:bg-indigo-500">
                    <Link href="/collections">
                      {t("csvImport.viewCollections")}
                    </Link>
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
