"use client";

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
import { PermissionGate } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import { formatAccessionMethodLabel } from "../../../[id]/_components/accession-detail-ui";
import type { ImportState } from "../import-accessions-types";

interface ImportAccessionsPreviewStepProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  onBackToValidation: () => void;
  onStartImport: () => void;
}

export function ImportAccessionsPreviewStep({
  state,
  t,
  onBackToValidation,
  onStartImport,
}: ImportAccessionsPreviewStepProps) {
  const tRoot = useI18n();
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
            {tRoot("untranslatedRecords.collections.import.backToValidation")}
          </Button>
          <PermissionGate permission="collections.create">
            <Button
              onClick={onStartImport}
              disabled={state.rows.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="mr-2 size-4" />
              {t("import.importButton", { count: state.rows.length })}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {state.validationErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {state.validationErrors.length}{" "}
              {tRoot("untranslatedRecords.collections.import.rowsSkipped")}
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
              <li>
                •{" "}
                {tRoot("untranslatedRecords.collections.import.andMoreErrors", {
                  count: state.errors.length - 5,
                })}
              </li>
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
