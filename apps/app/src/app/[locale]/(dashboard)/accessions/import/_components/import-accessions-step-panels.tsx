"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { MappedImportValidation } from "@/components/import/mapped-import-validation";
import { TrackedImportOutcome } from "@/components/import/tracked-import-outcome";
import { TrackedImportProgress } from "@/components/import/tracked-import-progress";
import type { FieldMapping } from "@/components/import-field-mapper";
import { ImportJobUnavailable } from "@/components/import-job-unavailable";
import type { ImportState } from "./import-accessions-types";
import { ImportAccessionsMappingStep } from "./steps/import-accessions-mapping-step";
import { ImportAccessionsPreviewStep } from "./steps/import-accessions-preview-step";
import { ImportAccessionsUploadStep } from "./steps/import-accessions-upload-step";
import type { useImportAccessions } from "./use-import-accessions";

export interface ImportAccessionsStepPanelsProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  run: ReturnType<typeof useImportAccessions>["run"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveMappings: (mappings: FieldMapping[]) => void;
  handleReset: () => void;
  handleContinueAfterValidation: () => void;
  handleStartImport: (resumeJobId?: Id<"importJobs">) => void;
  onBackToMapping: () => void;
  onBackToValidation: () => void;
}

export function ImportAccessionsStepPanels({
  state,
  t,
  run,
  fileInputRef,
  handleFileSelect,
  handleSaveMappings,
  handleReset,
  handleContinueAfterValidation,
  handleStartImport,
  onBackToMapping,
  onBackToValidation,
}: ImportAccessionsStepPanelsProps) {
  if (run.jobUnavailable) {
    return <ImportJobUnavailable onReset={handleReset} />;
  }

  if (run.phase === "importing") {
    return (
      <TrackedImportProgress
        importJob={run.importJob}
        fallbackTotal={state.rows.length}
        onCancel={run.cancel}
      />
    );
  }

  if (run.phase === "complete") {
    return (
      <TrackedImportOutcome
        importJob={run.importJob}
        errors={run.errors}
        fileName={state.file?.name}
        viewHref="/accessions"
        viewLabel={t("import.viewAccessions")}
        onReset={handleReset}
        onRetryFailed={run.retryFailed}
        onUploadCorrection={run.uploadCorrection}
      />
    );
  }

  if (state.step === "upload") {
    return (
      <ImportAccessionsUploadStep
        t={t}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        errors={state.errors}
      />
    );
  }

  if (state.step === "mapping") {
    return (
      <ImportAccessionsMappingStep
        state={state}
        t={t}
        onReset={handleReset}
        onSaveMappings={handleSaveMappings}
      />
    );
  }

  if (state.step === "validation") {
    return (
      <MappedImportValidation
        rowCount={state.rows.length}
        validationErrors={state.validationErrors}
        onBackToMapping={onBackToMapping}
        onContinue={handleContinueAfterValidation}
      />
    );
  }

  return (
    <ImportAccessionsPreviewStep
      state={state}
      t={t}
      runErrors={run.errors}
      onBackToValidation={onBackToValidation}
      onStartImport={handleStartImport}
    />
  );
}
