"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { parseCSV } from "../../import/import-csv";
import { ImportCompleteStep } from "./import-complete-step";
import { ImportPreviewStep } from "./import-preview-step";
import { ImportProgressStep } from "./import-progress-step";
import { ImportUploadStep } from "./import-upload-step";
import { INITIAL_IMPORT_STATE, type ImportLocationsState } from "./types";
import { useTranslatedParseError } from "./use-translated-parse-error";

export function ImportLocationsPage() {
  const t = useScopedI18n("locations");
  const translateParseError = useTranslatedParseError();
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] =
    useState<ImportLocationsState>(INITIAL_IMPORT_STATE);

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
          parseErrors: errors,
          runtimeErrors: [],
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

      const results = await Promise.all(
        batches.map((batch, batchIndex) =>
          importBatch({
            organizationId: currentOrganizationId as Id<"organizations">,
            jobId,
            rows: batch,
            batchIndex,
          }),
        ),
      );
      const allErrors = results.flatMap((result) => result.errors);

      setState((prev) => ({
        ...prev,
        step: "complete",
        runtimeErrors: [...prev.runtimeErrors, ...allErrors],
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        runtimeErrors: [
          ...prev.runtimeErrors,
          err instanceof Error ? err.message : t("importFailed"),
        ],
      }));
    }
  }, [currentOrganizationId, state.rows, createImportJob, importBatch, t]);

  const handleReset = useCallback(() => {
    setState(INITIAL_IMPORT_STATE);
  }, []);

  const downloadTemplate = useCallback(() => {
    const headers =
      "name,locationCode,type,parentLocation,address,capacity,notes";
    const example =
      '"Main Gallery","G-001","gallery","","123 Museum Ave","100","Primary exhibition space"';
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
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationToImport")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/locations">
                <ArrowLeft className="mr-2 size-4" />
                {t("backToLocations")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "upload" && (
              <ImportUploadStep
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
              />
            )}

            {state.step === "preview" && (
              <ImportPreviewStep
                rows={state.rows}
                fileName={state.file?.name}
                parseErrors={state.parseErrors}
                translateParseError={translateParseError}
                onReset={handleReset}
                onStartImport={handleStartImport}
              />
            )}

            {state.step === "importing" && (
              <ImportProgressStep
                processedItems={importJob?.processedItems || 0}
                totalItems={importJob?.totalItems || state.rows.length}
                progress={importJob?.progress || 0}
              />
            )}

            {state.step === "complete" && (
              <ImportCompleteStep
                importedCount={importJob?.processedItems || state.rows.length}
                runtimeErrors={state.runtimeErrors}
                onReset={handleReset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
