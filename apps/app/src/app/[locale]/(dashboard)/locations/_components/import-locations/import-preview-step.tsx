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
import { AlertCircle, Upload, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { ParsedRow, ParseError } from "../../import/import-csv";

interface ImportPreviewStepProps {
  rows: ParsedRow[];
  fileName?: string;
  parseErrors: ParseError[];
  translateParseError: (error: ParseError) => string;
  onReset: () => void;
  onStartImport: () => void;
}

export function ImportPreviewStep({
  rows,
  fileName,
  parseErrors,
  translateParseError,
  onReset,
  onStartImport,
}: ImportPreviewStepProps) {
  const t = useScopedI18n("locations");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("previewImport")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("rowsReadyToImport", {
              count: rows.length.toString(),
              filename: fileName || "",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset}>
            <X className="mr-2 size-4" />
            {t("cancel")}
          </Button>
          <PermissionGate permission="organization.manage_settings">
            <PermissionGate permission="locations.create">
              <Button
                onClick={onStartImport}
                disabled={rows.length === 0}
                className="bg-primary hover:bg-primary/90"
              >
                <Upload className="mr-2 size-4" />
                {t("importLocations", { count: rows.length.toString() })}
              </Button>
            </PermissionGate>
          </PermissionGate>
        </div>
      </div>

      {parseErrors.length > 0 && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {t("validationErrors", {
                count: parseErrors.length.toString(),
              })}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive">
            {parseErrors.slice(0, 5).map((error, index) => (
              <li key={`${error.type}-${error.row ?? index}`}>
                {translateParseError(error)}
              </li>
            ))}
            {parseErrors.length > 5 && (
              <li>
                {t("importErrors.andMore", {
                  count: (parseErrors.length - 5).toString(),
                })}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t("tableHeaders.name")}</TableHead>
              <TableHead>{t("tableHeaders.locationCode")}</TableHead>
              <TableHead>{t("tableHeaders.type")}</TableHead>
              <TableHead>{t("tableHeaders.parentLocation")}</TableHead>
              <TableHead>{t("tableHeaders.address")}</TableHead>
              <TableHead>{t("tableHeaders.capacity")}</TableHead>
              <TableHead>{t("tableHeaders.notes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 20).map((row, rowIndex) => (
              <TableRow
                key={`${row.name}-${row.locationCode}-${row.type}-${row.parentLocation ?? ""}`}
              >
                <TableCell className="text-muted-foreground">
                  {rowIndex + 1}
                </TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.locationCode}</TableCell>
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
        {rows.length > 20 && (
          <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
            {t("importErrors.showingRows", {
              shown: "20",
              total: rows.length.toString(),
            })}
          </div>
        )}
      </div>
    </div>
  );
}
