"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect } from "react";
import { useI18n } from "@/locales/client";
import type { MappingType, MediaImportState } from "./media-import-types";

interface UseMediaImportOptions {
  currentOrganizationId: string | null;
  state: MediaImportState;
  setState: React.Dispatch<React.SetStateAction<MediaImportState>>;
  mediaInputRef: React.RefObject<HTMLInputElement | null>;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useMediaImport({
  currentOrganizationId,
  state,
  setState,
  mediaInputRef,
  csvInputRef,
}: UseMediaImportOptions) {
  const tRoot = useI18n();
  const createJob = useMutation(api.mediaImports.createMediaImportJob);
  const generateUrl = useMutation(api.mediaImports.generateBulkUploadUrl);
  const recordFile = useMutation(api.mediaImports.recordUploadedFile);
  const parseCsv = useMutation(api.mediaImports.parseMappingCsv);

  const importJob = useQuery(
    api.mediaImports.getMediaImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

  const handleMappingSelect = useCallback(
    (type: MappingType) => {
      setState((prev) => ({ ...prev, mappingType: type, step: "upload" }));
    },
    [setState],
  );

  const handleMediaSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        setState((prev) => ({
          ...prev,
          mediaFiles: [...prev.mediaFiles, ...Array.from(e.target.files || [])],
        }));
      }
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    },
    [mediaInputRef, setState],
  );

  const handleCsvSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setState((prev) => ({ ...prev, csvFile: file }));
      }
      if (csvInputRef.current) csvInputRef.current.value = "";
    },
    [csvInputRef, setState],
  );

  const removeMediaFile = useCallback(
    (index: number) => {
      setState((prev) => ({
        ...prev,
        mediaFiles: prev.mediaFiles.filter((_, i) => i !== index),
      }));
    },
    [setState],
  );

  const startImport = useCallback(async () => {
    if (!currentOrganizationId) return;
    if (state.mediaFiles.length === 0) return;

    try {
      let mappingData:
        | { filename: string; accessionNumber: string }[]
        | undefined;

      if (state.mappingType === "csv") {
        if (!state.csvFile) {
          alert(
            tRoot("untranslatedRecords.collections.media.uploadMappingCsv"),
          );
          return;
        }
        const text = await state.csvFile.text();
        const { mappings, errors } = await parseCsv({
          organizationId: currentOrganizationId as Id<"organizations">,
          csvContent: text,
        });

        if (errors.length > 0) {
          alert(
            tRoot("untranslatedRecords.collections.media.csvErrors", {
              errors: errors.join("\n"),
            }),
          );
          return;
        }
        mappingData = mappings;
      }

      const jobId = await createJob({
        organizationId: currentOrganizationId as Id<"organizations">,
        totalFiles: state.mediaFiles.length,
        mappingType: state.mappingType,
        mappingData,
      });

      setState((prev) => ({
        ...prev,
        jobId,
        step: "importing",
        currentFileIndex: 0,
      }));

      await Promise.all(
        state.mediaFiles.map(async (file, i) => {
          setState((prev) => ({ ...prev, currentFileIndex: i }));

          try {
            const { uploadUrl } = await generateUrl({
              organizationId: currentOrganizationId as Id<"organizations">,
              jobId,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            });

            const uploadRes = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": file.type },
              body: file,
            });

            if (!uploadRes.ok)
              throw new Error(`Upload failed: ${uploadRes.statusText}`);
            const { storageId } = await uploadRes.json();

            await recordFile({
              organizationId: currentOrganizationId as Id<"organizations">,
              jobId,
              storageId: storageId as Id<"_storage">,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            });
          } catch (err) {
            console.error(`Error uploading ${file.name}:`, err);
            setState((prev) => ({
              ...prev,
              uploadErrors: [
                ...prev.uploadErrors,
                `${file.name}: ${err instanceof Error ? err.message : tRoot("untranslatedRecords.accessions.detail.unknown")}`,
              ],
            }));
          }
        }),
      );

      setState((prev) => ({ ...prev, step: "complete" }));
    } catch (err) {
      console.error("Import failed:", err);
      alert(tRoot("untranslatedRecords.collections.media.failedStartImport"));
    }
  }, [
    currentOrganizationId,
    state.mediaFiles,
    state.mappingType,
    state.csvFile,
    createJob,
    parseCsv,
    generateUrl,
    recordFile,
    setState,
    tRoot,
  ]);

  const reset = useCallback(() => {
    setState({
      step: "select-mapping",
      mappingType: "manual",
      mediaFiles: [],
      csvFile: null,
      jobId: null,
      currentFileIndex: 0,
      uploadErrors: [],
    });
  }, [setState]);

  const goToReviewUnmapped = useCallback(() => {
    setState((prev) => ({ ...prev, step: "review-unmapped" }));
  }, [setState]);

  const goToComplete = useCallback(() => {
    setState((prev) => ({ ...prev, step: "complete" }));
  }, [setState]);

  const clearCsvFile = useCallback(() => {
    setState((prev) => ({ ...prev, csvFile: null }));
  }, [setState]);

  const clearMediaFiles = useCallback(() => {
    setState((prev) => ({ ...prev, mediaFiles: [] }));
  }, [setState]);

  useEffect(() => {
    if (
      state.step === "complete" &&
      importJob?.failedMappings &&
      importJob.failedMappings > 0
    ) {
      // Reserved for auto-navigation if needed later
    }
  }, [state.step, importJob]);

  return {
    importJob,
    handleMappingSelect,
    handleMediaSelect,
    handleCsvSelect,
    removeMediaFile,
    startImport,
    reset,
    goToReviewUnmapped,
    goToComplete,
    clearCsvFile,
    clearMediaFiles,
  };
}
