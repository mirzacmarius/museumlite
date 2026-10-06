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
import { AlertCircle, ArrowLeft, Upload } from "lucide-react";
import { ResumableImportNotice } from "@/components/import/resumable-import-notice";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { ImportState } from "../import-objects-types";

interface ImportObjectsPreviewStepProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Errors from a start attempt that never reached the server. */
  runErrors: string[];
  onBackToValidation: () => void;
  onStartImport: (resumeJobId?: Id<"importJobs">) => void;
}

export function ImportObjectsPreviewStep({
  state,
  t,
  runErrors,
  onBackToValidation,
  onStartImport,
}: ImportObjectsPreviewStepProps) {
  const { currentOrganizationId } = useOrganization();
  const tracked = useScopedI18n("trackedImport");
  const errors = [...state.errors, ...runErrors];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {t("csvImport.previewTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("csvImport.previewDescription", {
              count: state.rows.length,
              filename: state.file?.name ?? "",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBackToValidation}>
            <ArrowLeft className="mr-2 size-4" />
            {tracked("backToValidation")}
          </Button>
          <PermissionGate permission="collections.create">
            <Button
              onClick={() => onStartImport()}
              disabled={state.rows.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="mr-2 size-4" />
              {t("csvImport.importButton", { count: state.rows.length })}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <PermissionGate permission="collections.create">
        <ResumableImportNotice
          organizationId={currentOrganizationId}
          entityType="objects"
          fingerprint={state.fingerprint}
          rowCount={state.rows.length}
          onResume={(jobId) => onStartImport(jobId)}
        />
      </PermissionGate>

      {state.validationErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {tracked("rowsWillFail", {
                count: state.validationErrors.length,
              })}
            </span>
          </div>
        </div>
      ) : null}

      {errors.length > 0 ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {tracked("issues", { count: errors.length })}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive">
            {errors.slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                {t("csvImport.tableHeaders.number")}
              </TableHead>
              <TableHead>{t("csvImport.tableHeaders.accession")}</TableHead>
              <TableHead>{t("csvImport.tableHeaders.title")}</TableHead>
              <TableHead>{t("csvImport.tableHeaders.creator")}</TableHead>
              <TableHead>{t("csvImport.tableHeaders.type")}</TableHead>
              <TableHead>{t("csvImport.tableHeaders.period")}</TableHead>
              <TableHead>{t("csvImport.tableHeaders.location")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.rows.slice(0, 20).map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell className="text-muted-foreground">
                  {row.rowNumber}
                </TableCell>
                <TableCell>
                  {row.accessionNumber || t("csvImport.autoAccession")}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {row.title || "-"}
                </TableCell>
                <TableCell>{row.creator || "-"}</TableCell>
                <TableCell>{row.objectType || "-"}</TableCell>
                <TableCell>{row.period || "-"}</TableCell>
                <TableCell>{row.location || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {state.rows.length > 20 ? (
          <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
            {t("csvImport.showingRows", { count: state.rows.length })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
