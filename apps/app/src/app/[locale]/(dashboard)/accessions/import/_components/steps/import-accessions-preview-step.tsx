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
import { useI18n, useScopedI18n } from "@/locales/client";
import { formatAccessionMethodLabel } from "../../../[id]/_components/accession-detail-ui";
import type { ImportState } from "../import-accessions-types";

interface ImportAccessionsPreviewStepProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Errors from a start attempt that never reached the server. */
  runErrors: string[];
  onBackToValidation: () => void;
  onStartImport: (resumeJobId?: Id<"importJobs">) => void;
}

export function ImportAccessionsPreviewStep({
  state,
  t,
  runErrors,
  onBackToValidation,
  onStartImport,
}: ImportAccessionsPreviewStepProps) {
  const { currentOrganizationId } = useOrganization();
  const tRoot = useI18n();
  const tracked = useScopedI18n("trackedImport");
  const errors = [...state.errors, ...runErrors];
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
              {t("import.importButton", { count: state.rows.length })}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <PermissionGate permission="collections.create">
        <ResumableImportNotice
          organizationId={currentOrganizationId}
          entityType="accessions"
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
              <li key={error}>• {error}</li>
            ))}
            {errors.length > 5 ? (
              <li>• ... and {errors.length - 5} more</li>
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
                <TableCell>
                  {formatAccessionMethodLabel(row.method, tRoot)}
                </TableCell>
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
