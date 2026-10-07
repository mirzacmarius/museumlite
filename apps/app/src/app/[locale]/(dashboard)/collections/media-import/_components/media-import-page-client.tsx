"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { MediaImportStepPanels } from "./media-import-step-panels";
import {
  initialMediaImportState,
  type MediaImportState,
} from "./media-import-types";
import { MediaImportUnmappedReview } from "./media-import-unmapped-review";
import { useMediaImport } from "./use-media-import";

export function MediaImportPageClient() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [state, setState] = useState<MediaImportState>(initialMediaImportState);

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const {
    importJob,
    mediaJob,
    resumableJob,
    handleMappingSelect,
    handleMediaSelect,
    handleCsvSelect,
    removeMediaFile,
    startImport,
    continueImport,
    cancel,
    reset,
    goToReviewUnmapped,
    goToComplete,
    clearCsvFile,
    clearMediaFiles,
  } = useMediaImport({
    currentOrganizationId,
    state,
    setState,
    mediaInputRef,
    csvInputRef,
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationContinue")}
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
              <Link href="/collections">
                <ArrowLeft className="mr-2 size-4" />
                {t("backToCollections")}
              </Link>
            </Button>
            <div className="text-sm text-muted-foreground">
              {t("mediaImport.title")}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "review-unmapped" && state.jobId ? (
              <MediaImportUnmappedReview
                jobId={state.jobId}
                onComplete={goToComplete}
              />
            ) : (
              <MediaImportStepPanels
                state={state}
                importJob={importJob}
                unmappedFiles={mediaJob?.failedMappings ?? 0}
                resumableJob={resumableJob}
                t={t}
                common={common}
                mediaInputRef={mediaInputRef}
                csvInputRef={csvInputRef}
                handleMappingSelect={handleMappingSelect}
                handleMediaSelect={handleMediaSelect}
                handleCsvSelect={handleCsvSelect}
                removeMediaFile={removeMediaFile}
                startImport={startImport}
                continueImport={continueImport}
                cancel={cancel}
                reset={reset}
                clearCsvFile={clearCsvFile}
                clearMediaFiles={clearMediaFiles}
                goToReviewUnmapped={goToReviewUnmapped}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
