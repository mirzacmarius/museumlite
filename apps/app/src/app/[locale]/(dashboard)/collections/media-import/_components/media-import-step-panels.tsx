"use client";

import type { RefObject } from "react";
import type { MediaImportState } from "./media-import-types";
import { MediaImportCompleteStep } from "./steps/media-import-complete-step";
import { MediaImportImportingStep } from "./steps/media-import-importing-step";
import { MediaImportSelectMappingStep } from "./steps/media-import-select-mapping-step";
import { MediaImportUploadStep } from "./steps/media-import-upload-step";

interface MediaImportJob {
  processedItems?: number;
  successfulMappings?: number;
  failedMappings?: number;
}

export interface MediaImportStepPanelsProps {
  state: MediaImportState;
  importJob: MediaImportJob | null | undefined;
  t: (key: string) => string;
  common: (key: string) => string;
  mediaInputRef: RefObject<HTMLInputElement | null>;
  csvInputRef: RefObject<HTMLInputElement | null>;
  handleMappingSelect: (type: "csv" | "filename" | "manual") => void;
  handleMediaSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCsvSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeMediaFile: (index: number) => void;
  startImport: () => void;
  reset: () => void;
  clearCsvFile: () => void;
  clearMediaFiles: () => void;
  goToReviewUnmapped: () => void;
}

export function MediaImportStepPanels({
  state,
  importJob,
  t,
  common,
  mediaInputRef,
  csvInputRef,
  handleMappingSelect,
  handleMediaSelect,
  handleCsvSelect,
  removeMediaFile,
  startImport,
  reset,
  clearCsvFile,
  clearMediaFiles,
  goToReviewUnmapped,
}: MediaImportStepPanelsProps) {
  if (state.step === "select-mapping") {
    return (
      <MediaImportSelectMappingStep
        t={t}
        onMappingSelect={handleMappingSelect}
      />
    );
  }

  if (state.step === "upload") {
    return (
      <MediaImportUploadStep
        state={state}
        t={t}
        common={common}
        mediaInputRef={mediaInputRef}
        csvInputRef={csvInputRef}
        onCsvSelect={handleCsvSelect}
        onMediaSelect={handleMediaSelect}
        onRemoveMediaFile={removeMediaFile}
        onStartImport={startImport}
        onReset={reset}
        onClearCsvFile={clearCsvFile}
        onClearMediaFiles={clearMediaFiles}
      />
    );
  }

  if (state.step === "importing") {
    return <MediaImportImportingStep state={state} t={t} />;
  }

  if (state.step === "complete") {
    return (
      <MediaImportCompleteStep
        state={state}
        importJob={importJob}
        t={t}
        onReset={reset}
        onGoToReviewUnmapped={goToReviewUnmapped}
      />
    );
  }

  return null;
}
