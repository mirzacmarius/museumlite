"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { sha256Hex } from "@/lib/csv-parser";
import { useScopedI18n } from "@/locales/client";
import {
  type MediaImportItemAction,
  mediaSelectionSignature,
  orderMediaFiles,
  planMediaImportItems,
} from "./media-import-items";
import {
  initialMediaImportState,
  type MappingType,
  type MediaImportState,
} from "./media-import-types";

/** Files uploaded at the same time; more would compete for the connection. */
const UPLOAD_CONCURRENCY = 3;

type ImportRowResultsPage = FunctionReturnType<
  typeof api.imports.listImportRowResults
>;

interface UseMediaImportOptions {
  currentOrganizationId: string | null;
  state: MediaImportState;
  setState: React.Dispatch<React.SetStateAction<MediaImportState>>;
  mediaInputRef: React.RefObject<HTMLInputElement | null>;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Runs a media import as a tracked job: each selected file is one item with a
 * durable outcome, so resuming or retrying skips attached files and reuses
 * originals the job already retained instead of uploading them again.
 */
export function useMediaImport({
  currentOrganizationId,
  state,
  setState,
  mediaInputRef,
  csvInputRef,
}: UseMediaImportOptions) {
  const t = useScopedI18n("collections");
  const tracked = useScopedI18n("trackedImport");
  const actionMessage = useActionErrorMessage();
  const convex = useConvex();
  const createJob = useMutation(api.mediaImports.createMediaImportJob);
  const generateUrl = useMutation(api.mediaImports.generateBulkUploadUrl);
  const recordFile = useMutation(api.mediaImports.recordUploadedFile);
  const parseCsv = useMutation(api.mediaImports.parseMappingCsv);
  const cancelJob = useMutation(api.imports.cancelImportJob);
  const stopRef = useRef(false);

  const importJob = useQuery(
    api.imports.getImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );
  const mediaJob = useQuery(
    api.mediaImports.getMediaImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );
  const resumableJob = useQuery(
    api.mediaImports.findResumableMediaImportJob,
    currentOrganizationId && state.fingerprint && state.step === "upload"
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          sourceFingerprint: state.fingerprint,
        }
      : "skip",
  );

  useEffect(() => {
    let current = true;
    if (state.mediaFiles.length === 0) {
      setState((prev) => ({ ...prev, fingerprint: null }));
      return;
    }
    void sha256Hex(mediaSelectionSignature(state.mediaFiles)).then(
      (fingerprint) => {
        if (current) setState((prev) => ({ ...prev, fingerprint }));
      },
    );
    return () => {
      current = false;
    };
  }, [state.mediaFiles, setState]);

  const handleMappingSelect = useCallback(
    (type: MappingType) => {
      setState((prev) => ({ ...prev, mappingType: type, step: "upload" }));
    },
    [setState],
  );

  const handleMediaSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length) {
        setState((prev) => ({
          ...prev,
          mediaFiles: orderMediaFiles([...prev.mediaFiles, ...selected]),
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

  const acceptedItems = useCallback(
    async (jobId: Id<"importJobs">) => {
      const accepted = new Set<number>();
      let cursor: string | null = null;
      for (;;) {
        const page: ImportRowResultsPage = await convex.query(
          api.imports.listImportRowResults,
          {
            jobId,
            status: "accepted",
            paginationOpts: { numItems: 200, cursor },
          },
        );
        for (const row of page.page) accepted.add(row.rowNumber);
        if (page.isDone) return accepted;
        cursor = page.continueCursor;
      }
    },
    [convex],
  );

  const retainedOriginals = useCallback(
    async (jobId: Id<"importJobs">) => {
      const files = await convex.query(api.mediaImports.getUnmappedFiles, {
        jobId,
      });
      return new Map(
        files.flatMap((file) =>
          file.itemNumber === undefined
            ? []
            : [[file.itemNumber, file.storageId] as const],
        ),
      );
    },
    [convex],
  );

  /** Sends one item; returns the job's recorded problem, if any. */
  const sendItem = useCallback(
    async (
      organizationId: Id<"organizations">,
      jobId: Id<"importJobs">,
      action: MediaImportItemAction<File>,
    ) => {
      const { file, itemNumber } = action;
      let storageId: Id<"_storage">;
      if (action.kind === "retry-retained") {
        storageId = action.storageId;
      } else {
        const { uploadUrl } = await generateUrl({
          organizationId,
          jobId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) {
          throw new Error(
            (await response.text()) || t("mediaImport.uploadFailed"),
          );
        }
        storageId = ((await response.json()) as { storageId: Id<"_storage"> })
          .storageId;
      }
      const result = await recordFile({
        organizationId,
        jobId,
        itemNumber,
        storageId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      return result.error;
    },
    [generateUrl, recordFile, t],
  );

  /** Sends every item that is not yet attached, a few at a time. */
  const runItems = useCallback(
    async (jobId: Id<"importJobs">, files: File[]) => {
      if (!currentOrganizationId) return;
      const organizationId = currentOrganizationId as Id<"organizations">;
      stopRef.current = false;
      setState((prev) => ({
        ...prev,
        jobId,
        step: "importing",
        uploadErrors: [],
      }));
      const problems: string[] = [];
      try {
        const [accepted, retained] = await Promise.all([
          acceptedItems(jobId),
          retainedOriginals(jobId),
        ]);
        const plan = planMediaImportItems(files, accepted, retained);
        let next = 0;
        const worker = async () => {
          while (!stopRef.current) {
            const action = plan[next++];
            if (!action) return;
            try {
              const error = await sendItem(organizationId, jobId, action);
              if (error) problems.push(`${action.file.name}: ${error}`);
            } catch (error) {
              problems.push(
                `${action.file.name}: ${actionMessage(error, tracked("importFailed"))}`,
              );
            }
          }
        };
        await Promise.all(
          Array.from(
            { length: Math.min(UPLOAD_CONCURRENCY, plan.length) },
            worker,
          ),
        );
      } catch (error) {
        problems.push(actionMessage(error, tracked("importFailed")));
      }
      setState((prev) => ({
        ...prev,
        step: "complete",
        uploadErrors: problems,
      }));
    },
    [
      acceptedItems,
      currentOrganizationId,
      retainedOriginals,
      sendItem,
      setState,
      tracked,
    ],
  );

  const startImport = useCallback(
    async (resumeJobId?: Id<"importJobs">) => {
      if (!currentOrganizationId) return;
      const files = state.mediaFiles;
      if (files.length === 0) return;
      if (resumeJobId) {
        await runItems(resumeJobId, files);
        return;
      }

      try {
        let mappingData:
          | { filename: string; accessionNumber: string }[]
          | undefined;

        if (state.mappingType === "csv") {
          if (!state.csvFile) {
            toast.error(t("mediaImport.errorNoCSV"));
            return;
          }
          const { mappings, errors } = await parseCsv({
            organizationId: currentOrganizationId as Id<"organizations">,
            csvContent: await state.csvFile.text(),
          });
          if (errors.length > 0) {
            toast.error(
              t("mediaImport.errorCSV", { errors: errors.join("\n") }),
            );
            return;
          }
          mappingData = mappings;
        }

        const jobId = await createJob({
          organizationId: currentOrganizationId as Id<"organizations">,
          totalFiles: files.length,
          mappingType: state.mappingType,
          mappingData,
          sourceName: t("mediaImport.sourceName", { count: files.length }),
          sourceFingerprint: state.fingerprint ?? undefined,
        });
        await runItems(jobId, files);
      } catch (error) {
        toast.error(actionMessage(error, tracked("importFailed")));
      }
    },
    [
      currentOrganizationId,
      state.mediaFiles,
      state.mappingType,
      state.csvFile,
      state.fingerprint,
      createJob,
      parseCsv,
      runItems,
      t,
      tracked,
    ],
  );

  /** Re-sends failed and unsent items; attached items are skipped. */
  const continueImport = useCallback(async () => {
    if (state.jobId) await runItems(state.jobId, state.mediaFiles);
  }, [runItems, state.jobId, state.mediaFiles]);

  const cancel = useCallback(async () => {
    stopRef.current = true;
    if (state.jobId) await cancelJob({ jobId: state.jobId });
  }, [cancelJob, state.jobId]);

  const reset = useCallback(() => {
    stopRef.current = true;
    setState(initialMediaImportState);
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

  return {
    importJob,
    mediaJob,
    resumableJob:
      resumableJob && resumableJob.totalItems === state.mediaFiles.length
        ? resumableJob
        : null,
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
  };
}
