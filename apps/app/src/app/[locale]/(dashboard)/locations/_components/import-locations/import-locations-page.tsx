"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation } from "convex/react";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { TrackedImportOutcome } from "@/components/import/tracked-import-outcome";
import { TrackedImportProgress } from "@/components/import/tracked-import-progress";
import { ImportJobUnavailable } from "@/components/import-job-unavailable";
import { useOrganization } from "@/components/organization-provider";
import { useTrackedImportFlow } from "@/hooks/use-tracked-import-flow";
import { sha256Hex } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import {
  MAX_LOCATION_IMPORT_ROWS,
  type ParsedRow,
  parseCSV,
} from "../../import/import-csv";
import { ImportPreviewStep } from "./import-preview-step";
import { ImportUploadStep } from "./import-upload-step";
import { type ImportLocationsState, INITIAL_IMPORT_STATE } from "./types";
import { useTranslatedParseError } from "./use-translated-parse-error";

export function ImportLocationsPage() {
  const t = useScopedI18n("locations");
  const translateParseError = useTranslatedParseError();
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] =
    useState<ImportLocationsState>(INITIAL_IMPORT_STATE);

  const importBatch = useMutation(api.imports.importLocationsBatch);
  const run = useTrackedImportFlow<ParsedRow>({
    organizationId: currentOrganizationId,
    entityType: "locations",
    sendBatch: importBatch,
    parseCorrection: (text) => {
      const { rows, errors } = parseCSV(text);
      const fatal = errors.find((error) => error.row === undefined);
      if (fatal) return translateParseError(fatal);
      return rows;
    },
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      void (async () => {
        const text = await file.text();
        const { rows, errors } = parseCSV(text);
        setState({
          step: "preview",
          file,
          fingerprint: await sha256Hex(text),
          rows,
          parseErrors:
            rows.length > MAX_LOCATION_IMPORT_ROWS
              ? [
                  {
                    type: "tooManyRows",
                    columns: String(MAX_LOCATION_IMPORT_ROWS),
                  },
                ]
              : errors,
        });
      })();

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [],
  );

  const handleStartImport = useCallback(
    (resumeJobId?: Id<"importJobs">) => {
      if (state.rows.length === 0) return;
      void run.start(state.rows, {
        sourceName: state.file?.name,
        fingerprint: state.fingerprint,
        resumeJobId,
      });
    },
    [run, state.file, state.fingerprint, state.rows],
  );

  const handleReset = useCallback(() => {
    run.reset();
    setState(INITIAL_IMPORT_STATE);
  }, [run]);

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
            {run.jobUnavailable ? (
              <ImportJobUnavailable onReset={handleReset} />
            ) : run.phase === "importing" ? (
              <TrackedImportProgress
                importJob={run.importJob}
                fallbackTotal={state.rows.length}
                onCancel={run.cancel}
              />
            ) : run.phase === "complete" ? (
              <TrackedImportOutcome
                importJob={run.importJob}
                errors={run.errors}
                fileName={state.file?.name}
                viewHref="/locations"
                viewLabel={t("viewLocations")}
                onReset={handleReset}
                onRetryFailed={run.retryFailed}
                onUploadCorrection={run.uploadCorrection}
              />
            ) : state.step === "upload" ? (
              <ImportUploadStep
                fileInputRef={fileInputRef}
                onFileSelect={handleFileSelect}
              />
            ) : (
              <ImportPreviewStep
                rows={
                  state.parseErrors.some((error) => error.row === undefined)
                    ? []
                    : state.rows
                }
                fileName={state.file?.name}
                fingerprint={state.fingerprint}
                parseErrors={state.parseErrors}
                runErrors={run.errors}
                translateParseError={translateParseError}
                onReset={handleReset}
                onStartImport={handleStartImport}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
