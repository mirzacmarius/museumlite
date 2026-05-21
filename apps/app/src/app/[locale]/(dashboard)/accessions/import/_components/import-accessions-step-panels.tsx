"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { RefObject } from "react";
import type { FieldMapping } from "@/components/import-field-mapper";
import type { ImportState } from "./import-accessions-types";
import { ImportAccessionsCompleteStep } from "./steps/import-accessions-complete-step";
import { ImportAccessionsImportingStep } from "./steps/import-accessions-importing-step";
import { ImportAccessionsMappingStep } from "./steps/import-accessions-mapping-step";
import { ImportAccessionsPreviewStep } from "./steps/import-accessions-preview-step";
import { ImportAccessionsUploadStep } from "./steps/import-accessions-upload-step";
import { ImportAccessionsValidationStep } from "./steps/import-accessions-validation-step";

export interface ImportAccessionsStepPanelsProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveMappings: (mappings: FieldMapping[]) => void;
  handleReset: () => void;
  handleContinueAfterValidation: () => void;
  handleStartImport: () => void;
  onBackToMapping: () => void;
  onBackToValidation: () => void;
}

export function ImportAccessionsStepPanels({
  state,
  t,
  fileInputRef,
  handleFileSelect,
  handleSaveMappings,
  handleReset,
  handleContinueAfterValidation,
  handleStartImport,
  onBackToMapping,
  onBackToValidation,
}: ImportAccessionsStepPanelsProps) {
  const importJob = useQuery(
    api.imports.getImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

  if (state.step === "upload") {
    return (
      <ImportAccessionsUploadStep
        t={t}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
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
      <ImportAccessionsValidationStep
        state={state}
        onBackToMapping={onBackToMapping}
        onContinueAfterValidation={handleContinueAfterValidation}
      />
    );
  }

  if (state.step === "preview") {
    return (
      <ImportAccessionsPreviewStep
        state={state}
        t={t}
        onBackToValidation={onBackToValidation}
        onStartImport={handleStartImport}
      />
    );
  }

  if (state.step === "importing") {
    return (
      <ImportAccessionsImportingStep
        state={state}
        importJob={importJob}
        t={t}
      />
    );
  }

  if (state.step === "complete") {
    return (
      <ImportAccessionsCompleteStep
        state={state}
        importJob={importJob}
        t={t}
        onReset={handleReset}
      />
    );
  }

  return null;
}
