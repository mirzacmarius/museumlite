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
import type { ImportState } from "../import-objects-types";

interface ImportObjectsPreviewStepProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  onBackToValidation: () => void;
  onStartImport: () => void;
}

export function ImportObjectsPreviewStep({
  state,
  t,
  onBackToValidation,
  onStartImport,
}: ImportObjectsPreviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {t("csvImport.previewTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {state.rows.length} rows ready to import from {state.file?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBackToValidation}>
            <ArrowLeft className="mr-2 size-4" />
            Back to Validation
          </Button>
          <PermissionGate permission="collections.create">
            <Button
              onClick={onStartImport}
              disabled={state.rows.length === 0}
              className="bg-primary hover:bg-primary/90"
            >
              <Upload className="mr-2 size-4" />
              Import {state.rows.length} Objects
            </Button>
          </PermissionGate>
        </div>
      </div>

      {state.validationErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {state.validationErrors.length} rows were skipped due to
              validation errors
            </span>
          </div>
        </div>
      ) : null}

      {state.errors.length > 0 ? (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" />
            <span className="font-medium">
              {state.errors.length} validation errors
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-destructive">
            {state.errors.slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
            {state.errors.length > 5 ? (
              <li>... and {state.errors.length - 5} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

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
              <TableRow
                key={`${row.title}-${row.accessionNumber ?? ""}-${row.creator ?? ""}-${row.period ?? ""}`}
              >
                <TableCell className="text-muted-foreground">
                  {rowIndex + 1}
                </TableCell>
                <TableCell>{row.accessionNumber || "(auto)"}</TableCell>
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
        {state.rows.length > 20 ? (
          <div className="border-t border-border p-3 text-center text-sm text-muted-foreground">
            Showing 20 of {state.rows.length} rows
          </div>
        ) : null}
      </div>
    </div>
  );
}
