"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";
import {
  type FieldMapping,
  ImportFieldMapper,
} from "@/components/import-field-mapper";
import { PermissionGate } from "@/components/permission-gate";
import { type ImportState, TARGET_FIELDS } from "./import-accessions-types";

export interface ImportAccessionsStepPanelsProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveMappings: (mappings: FieldMapping[]) => void;
  handleReset: () => void;
  handleContinueAfterValidation: () => void;
  handleStartImport: () => void;
  onBackToMapping: () => void;
  onBackToValidation: () => void;
}

export function ImportAccessionsStepPanels({
  state,
  t,
  fileInputRef,
  handleFileSelect,
  handleSaveMappings,
  handleReset,
  handleContinueAfterValidation,
  handleStartImport,
  onBackToMapping,
  onBackToValidation,
}: ImportAccessionsStepPanelsProps) {
  const importJob = useQuery(
    api.imports.getImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

  return (
    <>
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

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-muted/30"
          >
            <Upload className="mb-4 size-10 text-muted-foreground" />
            <p className="font-medium">{t("import.dropZone")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("import.maxRows")}
            </p>
          </button>

          <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="mb-2 font-medium">{t("import.formatTitle")}</h3>
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
                {state.rows.length} valid rows, {state.validationErrors.length}{" "}
                errors
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBackToMapping}>
                <ArrowLeft className="mr-2 size-4" />
                Back to Mapping
              </Button>
              {state.rows.length > 0 && (
                <Button
                  onClick={handleContinueAfterValidation}
                  className="bg-primary hover:bg-primary/90"
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
                {Array.from(new Set(state.validationErrors)).map((error) => (
                  <li key={error}>{error}</li>
                ))}
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
              <Button variant="outline" onClick={onBackToValidation}>
                <ArrowLeft className="mr-2 size-4" />
                Back to Validation
              </Button>
              <PermissionGate permission="collections.create">
                <Button
                  onClick={handleStartImport}
                  disabled={state.rows.length === 0}
                  className="bg-primary hover:bg-primary/90"
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
                  <TableHead>{t("import.tableHeaders.accession")}</TableHead>
                  <TableHead>{t("import.tableHeaders.dateReceived")}</TableHead>
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
          <h2 className="text-xl font-semibold">{t("import.importing")}</h2>
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
          <h2 className="text-xl font-semibold">{t("import.complete")}</h2>
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
                  {t("import.issuesMessage", { count: state.errors.length })}
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
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/accessions">{t("import.viewAccessions")}</Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
