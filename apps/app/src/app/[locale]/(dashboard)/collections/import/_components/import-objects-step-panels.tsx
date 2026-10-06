"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { MappedImportValidation } from "@/components/import/mapped-import-validation";
import { TrackedImportOutcome } from "@/components/import/tracked-import-outcome";
import { TrackedImportProgress } from "@/components/import/tracked-import-progress";
import type { FieldMapping } from "@/components/import-field-mapper";
import { ImportJobUnavailable } from "@/components/import-job-unavailable";
import type { ImportState } from "./import-objects-types";
import { ImportObjectsMappingStep } from "./steps/import-objects-mapping-step";
import { ImportObjectsPreviewStep } from "./steps/import-objects-preview-step";
import { ImportObjectsUploadStep } from "./steps/import-objects-upload-step";
import type { useImportObjects } from "./use-import-objects";

export interface ImportObjectsStepPanelsProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  common: (key: string) => string;
  run: ReturnType<typeof useImportObjects>["run"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTemplateSelect: (templateId: string) => void;
  getInitialMappings: () => FieldMapping[] | undefined;
  handleSaveMappings: (mappings: FieldMapping[]) => void;
  handleReset: () => void;
  handleContinueAfterValidation: () => void;
  handleStartImport: (resumeJobId?: Id<"importJobs">) => void;
  onBackToMapping: () => void;
  onBackToValidation: () => void;
}

export function ImportObjectsStepPanels({
  state,
  t,
  common,
  run,
  fileInputRef,
  handleFileSelect,
  handleTemplateSelect,
  getInitialMappings,
  handleSaveMappings,
  handleReset,
  handleContinueAfterValidation,
  handleStartImport,
  onBackToMapping,
  onBackToValidation,
}: ImportObjectsStepPanelsProps) {
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
        viewHref="/collections"
        viewLabel={t("csvImport.viewCollections")}
        onReset={handleReset}
        onRetryFailed={run.retryFailed}
        onUploadCorrection={run.uploadCorrection}
      />
    );
  }

  if (state.step === "upload") {
    return (
      <ImportObjectsUploadStep
        t={t}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
        errors={state.errors}
      />
    );
  }

  if (state.step === "mapping") {
    return (
      <ImportObjectsMappingStep
        state={state}
        common={common}
        onReset={handleReset}
        onTemplateSelect={handleTemplateSelect}
        getInitialMappings={getInitialMappings}
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
    <ImportObjectsPreviewStep
      state={state}
      t={t}
      runErrors={run.errors}
      onBackToValidation={onBackToValidation}
      onStartImport={handleStartImport}
    />
  );
}
