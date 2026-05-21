"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import type { RefObject } from "react";
import type { FieldMapping } from "@/components/import-field-mapper";
import type { ImportState } from "./import-objects-types";
import { ImportObjectsCompleteStep } from "./steps/import-objects-complete-step";
import { ImportObjectsImportingStep } from "./steps/import-objects-importing-step";
import { ImportObjectsMappingStep } from "./steps/import-objects-mapping-step";
import { ImportObjectsPreviewStep } from "./steps/import-objects-preview-step";
import { ImportObjectsUploadStep } from "./steps/import-objects-upload-step";
import { ImportObjectsValidationStep } from "./steps/import-objects-validation-step";

export interface ImportObjectsStepPanelsProps {
  state: ImportState;
  t: (key: string, params?: Record<string, string | number>) => string;
  common: (key: string) => string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTemplateSelect: (templateId: string) => void;
  getInitialMappings: () => FieldMapping[] | undefined;
  handleSaveMappings: (mappings: FieldMapping[]) => void;
  handleReset: () => void;
  handleContinueAfterValidation: () => void;
  handleStartImport: () => void;
  onBackToMapping: () => void;
  onBackToValidation: () => void;
}

export function ImportObjectsStepPanels({
  state,
  t,
  common,
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
  const importJob = useQuery(
    api.imports.getImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

  if (state.step === "upload") {
    return (
      <ImportObjectsUploadStep
        t={t}
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
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
      <ImportObjectsValidationStep
        state={state}
        onBackToMapping={onBackToMapping}
        onContinueAfterValidation={handleContinueAfterValidation}
      />
    );
  }

  if (state.step === "preview") {
    return (
      <ImportObjectsPreviewStep
        state={state}
        t={t}
        onBackToValidation={onBackToValidation}
        onStartImport={handleStartImport}
      />
    );
  }

  if (state.step === "importing") {
    return (
      <ImportObjectsImportingStep state={state} importJob={importJob} t={t} />
    );
  }

  if (state.step === "complete") {
    return (
      <ImportObjectsCompleteStep
        state={state}
        importJob={importJob}
        t={t}
        onReset={handleReset}
      />
    );
  }

  return null;
}
