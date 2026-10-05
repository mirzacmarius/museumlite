"use client";

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
import { AlertCircle, ArrowLeft, History, Upload } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import type { ImportState } from "../import-accessions-types";

interface ResumableImportJob {
  _id: Id<"importJobs">;
  createdAt: number;
  totalItems: number;
  attemptedItems: number;
  acceptedItems: number;
  failedItems: number;
}

interface ImportAccessionsPreviewStepProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  resumableJob: ResumableImportJob | null | undefined;
  onBackToValidation: () => void;
  onStartImport: (resumeJobId?: Id<"importJobs">) => void;
}

export function ImportAccessionsPreviewStep({
  state,
  t,
  resumableJob,
  onBackToValidation,
  onStartImport,
}: ImportAccessionsPreviewStepProps) {
  const canResume =
    resumableJob !== null &&
    resumableJob !== undefined &&
    resumableJob.totalItems === state.rows.length;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("import.previewTitle")}</h2>
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
            {t("import.backToValidation")}
          </Button>
          <PermissionGate permission="collections.create">
            <Button
              onClick={() => onStartImport()}
              disabled={state.rows.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="mr-2 size-4" />
              {canResume
                ? t("import.startNewImport")
                : t("import.importButton", { count: state.rows.length })}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {canResume ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm">
            <History className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {t("import.resumeNotice", {
                date: new Date(resumableJob.createdAt).toLocaleString(),
                attempted: resumableJob.attemptedItems,
                total: resumableJob.totalItems,
                accepted: resumableJob.acceptedItems,
                failed: resumableJob.failedItems,
              })}
            </span>
          </div>
          <PermissionGate permission="collections.create">
            <Button onClick={() => onStartImport(resumableJob._id)}>
              {t("import.resumeImport")}
            </Button>
          </PermissionGate>
        </div>
      ) : null}

      {state.validationErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("import.rowsWillFail", {
                count: state.validationErrors.length,
              })}
            </span>
          </div>
        </div>
      ) : null}

      {state.errors.length > 0 ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("import.validationErrors", { count: state.errors.length })}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive">
            {state.errors.slice(0, 5).map((error) => (
              <li key={error}>• {error}</li>
            ))}
            {state.errors.length > 5 ? (
              <li>• ... and {state.errors.length - 5} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

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
            {state.rows.slice(0, 20).map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="text-muted-foreground">
                  {row.rowNumber}
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
        {state.rows.length > 20 ? (
          <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
            {t("import.showingRows", { count: state.rows.length })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
