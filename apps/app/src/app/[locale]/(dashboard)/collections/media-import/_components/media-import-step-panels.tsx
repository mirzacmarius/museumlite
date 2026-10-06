"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import { ResumableImportJobNotice } from "@/components/import/resumable-import-notice";
import { useScopedI18n } from "@/locales/client";
import type { MediaImportState } from "./media-import-types";
import {
  MediaImportOutcomeStep,
  MediaImportProgressStep,
} from "./steps/media-import-run-steps";
import { MediaImportSelectMappingStep } from "./steps/media-import-select-mapping-step";
import { MediaImportUploadStep } from "./steps/media-import-upload-step";

type MediaImportJobView = Parameters<
  typeof MediaImportOutcomeStep
>[0]["importJob"];

export interface MediaImportStepPanelsProps {
  state: MediaImportState;
  importJob: MediaImportJobView;
  unmappedFiles: number;
  resumableJob:
    | (NonNullable<MediaImportJobView> & { createdAt: number })
    | null;
  t: (key: string) => string;
  common: (key: string) => string;
  mediaInputRef: RefObject<HTMLInputElement | null>;
  csvInputRef: RefObject<HTMLInputElement | null>;
  handleMappingSelect: (type: "csv" | "filename" | "manual") => void;
  handleMediaSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCsvSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeMediaFile: (index: number) => void;
  startImport: (resumeJobId?: Id<"importJobs">) => Promise<void>;
  continueImport: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => void;
  clearCsvFile: () => void;
  clearMediaFiles: () => void;
  goToReviewUnmapped: () => void;
}

export function MediaImportStepPanels({
  state,
  importJob,
  unmappedFiles,
  resumableJob,
  t,
  common,
  mediaInputRef,
  csvInputRef,
  handleMappingSelect,
  handleMediaSelect,
  handleCsvSelect,
  removeMediaFile,
  startImport,
  continueImport,
  cancel,
  reset,
  clearCsvFile,
  clearMediaFiles,
  goToReviewUnmapped,
}: MediaImportStepPanelsProps) {
  const collections = useScopedI18n("collections");

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
        onStartImport={() => void startImport()}
        onReset={reset}
        onClearCsvFile={clearCsvFile}
        onClearMediaFiles={clearMediaFiles}
        notice={
          resumableJob ? (
            <ResumableImportJobNotice
              message={collections("mediaImport.resumeNotice", {
                date: new Date(resumableJob.createdAt).toLocaleString(),
                attempted: resumableJob.attemptedItems,
                total: resumableJob.totalItems,
                accepted: resumableJob.acceptedItems,
                failed: resumableJob.failedItems,
              })}
              onResume={() => void startImport(resumableJob._id)}
            />
          ) : null
        }
      />
    );
  }

  if (state.step === "importing") {
    return (
      <MediaImportProgressStep
        importJob={importJob}
        fileCount={state.mediaFiles.length}
        onCancel={cancel}
      />
    );
  }

  if (state.step === "complete") {
    return (
      <MediaImportOutcomeStep
        importJob={importJob}
        unmappedFiles={unmappedFiles}
        fileCount={state.mediaFiles.length}
        errors={state.uploadErrors}
        onReset={reset}
        onContinue={continueImport}
        onReviewUnmapped={goToReviewUnmapped}
      />
    );
  }

  return null;
}
