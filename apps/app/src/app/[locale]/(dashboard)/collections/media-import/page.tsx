"use client";

import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type ImportStep =
  | "select-mapping"
  | "upload"
  | "importing"
  | "complete"
  | "review-unmapped";

type MappingType = "csv" | "filename" | "manual";

interface MediaImportState {
  step: ImportStep;
  mappingType: MappingType;
  mediaFiles: File[];
  csvFile: File | null;
  jobId: Id<"importJobs"> | null;
  currentFileIndex: number;
  uploadErrors: string[];
}

export default function MediaImportPage() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [state, setState] = useState<MediaImportState>({
    step: "select-mapping",
    mappingType: "manual",
    mediaFiles: [],
    csvFile: null,
    jobId: null,
    currentFileIndex: 0,
    uploadErrors: [],
  });

  const createJob = useMutation(api.mediaImports.createMediaImportJob);
  const generateUrl = useMutation(api.mediaImports.generateBulkUploadUrl);
  const recordFile = useMutation(api.mediaImports.recordUploadedFile);
  const parseCsv = useMutation(api.mediaImports.parseMappingCsv);

  const importJob = useQuery(
    api.mediaImports.getMediaImportJob,
    state.jobId ? { jobId: state.jobId } : "skip",
  );

  const handleMappingSelect = (type: MappingType) => {
    setState((prev) => ({ ...prev, mappingType: type, step: "upload" }));
  };

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setState((prev) => ({
        ...prev,
        mediaFiles: [...prev.mediaFiles, ...Array.from(e.target.files || [])],
      }));
    }
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setState((prev) => ({ ...prev, csvFile: file }));
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const removeMediaFile = (index: number) => {
    setState((prev) => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, i) => i !== index),
    }));
  };

  const startImport = async () => {
    if (!currentOrganizationId) return;
    if (state.mediaFiles.length === 0) return;

    try {
      let mappingData:
        | { filename: string; accessionNumber: string }[]
        | undefined;

      if (state.mappingType === "csv") {
        if (!state.csvFile) {
          alert("Please upload a mapping CSV file.");
          return;
        }
        const text = await state.csvFile.text();
        const { mappings, errors } = await parseCsv({
          organizationId: currentOrganizationId as Id<"organizations">,
          csvContent: text,
        });

        if (errors.length > 0) {
          alert(`CSV Errors:\n${errors.join("\n")}`);
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

      for (const [i, file] of state.mediaFiles.entries()) {
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
              `${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`,
            ],
          }));
        }
      }

      setState((prev) => ({ ...prev, step: "complete" }));
    } catch (err) {
      console.error("Import failed:", err);
      alert("Failed to start import job");
    }
  };

  const reset = () => {
    setState({
      step: "select-mapping",
      mappingType: "manual",
      mediaFiles: [],
      csvFile: null,
      jobId: null,
      currentFileIndex: 0,
      uploadErrors: [],
    });
  };

  useEffect(() => {
    if (
      state.step === "complete" &&
      importJob?.failedMappings &&
      importJob.failedMappings > 0
    ) {
    }
  }, [state.step, importJob]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationContinue")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/collections">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("backToCollections")}
              </Link>
            </Button>
            <div className="text-sm text-muted-foreground">
              {t("mediaImport.title")}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {state.step === "select-mapping" && (
              <div className="mx-auto max-w-4xl">
                <h2 className="mb-8 text-center text-2xl font-semibold">
                  {t("mediaImport.mappingTitle")}
                </h2>
                <div className="grid gap-6 md:grid-cols-3">
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-card text-card-foreground shadow-sm cursor-pointer p-6 transition-all hover:border-primary/50 hover:bg-muted/30 text-left"
                    onClick={() => handleMappingSelect("csv")}
                  >
                    <FileSpreadsheet className="mb-4 size-10 text-indigo-500" />
                    <h3 className="mb-2 font-medium">
                      {t("mediaImport.csvMapping")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("mediaImport.csvMappingDescription")}
                    </p>
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border border-border bg-card text-card-foreground shadow-sm cursor-pointer p-6 transition-all hover:border-primary/50 hover:bg-muted/30 text-left"
                    onClick={() => handleMappingSelect("filename")}
                  >
                    <FileImage className="mb-4 size-10 text-indigo-500" />
                    <h3 className="mb-2 font-medium">
                      {t("mediaImport.filenameExtraction")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("mediaImport.filenameExtractionDescription")}
                    </p>
                  </button>

                  <button
                    type="button"
                    className="rounded-lg border border-border bg-card text-card-foreground shadow-sm cursor-pointer p-6 transition-all hover:border-primary/50 hover:bg-muted/30 text-left"
                    onClick={() => handleMappingSelect("manual")}
                  >
                    <LinkIcon className="mb-4 size-10 text-indigo-500" />
                    <h3 className="mb-2 font-medium">
                      {t("mediaImport.manualMapping")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("mediaImport.manualMappingDescription")}
                    </p>
                  </button>
                </div>
              </div>
            )}

            {state.step === "upload" && (
              <div className="mx-auto max-w-3xl space-y-8">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">
                    {t("mediaImport.uploadTitle")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Selected method:{" "}
                    {state.mappingType === "csv"
                      ? "CSV Mapping"
                      : state.mappingType === "filename"
                        ? "Filename Extraction"
                        : "Manual Mapping"}
                  </p>
                </div>

                {state.mappingType === "csv" && (
                  <div className="space-y-4">
                    <h3 className="font-medium">1. Upload Mapping CSV</h3>
                    <button
                      type="button"
                      onClick={() => csvInputRef.current?.click()}
                      className={cn(
                        "flex w-full min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-4 transition-all hover:border-primary/50 hover:bg-muted/30",
                        state.csvFile && "border-primary/50 bg-primary/5",
                      )}
                    >
                      {state.csvFile ? (
                        <div className="flex items-center gap-2 text-primary">
                          <FileSpreadsheet className="h-6 w-6" />
                          <span className="font-medium">
                            {state.csvFile.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setState((s) => ({ ...s, csvFile: null }));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="mb-2 size-6 text-muted-foreground" />
                          <p className="text-sm font-medium">
                            Drop CSV file here
                          </p>
                        </>
                      )}
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleCsvSelect}
                      />
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-medium">
                    {state.mappingType === "csv"
                      ? "2. Upload Media Files"
                      : "Upload Media Files"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    className="flex w-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-muted/30"
                  >
                    <Upload className="mb-4 size-10 text-muted-foreground" />
                    <p className="font-medium">Drop media files here</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Images and PDFs supported
                    </p>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleMediaSelect}
                    />
                  </button>

                  {state.mediaFiles.length > 0 && (
                    <div className="rounded-lg border border-border">
                      <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30">
                        <span className="font-medium">
                          {state.mediaFiles.length} files selected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setState((s) => ({ ...s, mediaFiles: [] }))
                          }
                          className="text-destructive hover:text-destructive"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto p-2">
                        {state.mediaFiles.map((file, i) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between p-2 hover:bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="truncate text-sm">
                                {file.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeMediaFile(i)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={reset}>
                    {common("cancel")}
                  </Button>
                  <PermissionGate permission="media.upload">
                    <Button
                      onClick={startImport}
                      disabled={
                        state.mediaFiles.length === 0 ||
                        (state.mappingType === "csv" && !state.csvFile)
                      }
                      className="bg-indigo-600 hover:bg-indigo-500"
                    >
                      {t("mediaImport.startImport")}
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            )}

            {state.step === "importing" && (
              <div className="mx-auto max-w-md text-center pt-12">
                <Loader2 className="mx-auto mb-6 size-12 animate-spin text-primary" />
                <h2 className="text-xl font-semibold mb-2">
                  {t("mediaImport.importing")}
                </h2>
                <p className="text-muted-foreground mb-6">
                  Uploading {state.currentFileIndex + 1} of{" "}
                  {state.mediaFiles.length}
                </p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${(state.currentFileIndex / state.mediaFiles.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-8 text-sm text-muted-foreground">
                  Do not close this window until the import is complete.
                </div>
              </div>
            )}

            {state.step === "complete" && (
              <div className="mx-auto max-w-md text-center pt-8">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
                <h2 className="text-xl font-semibold">
                  {t("mediaImport.complete")}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Processed {importJob?.processedItems} files
                </p>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {importJob?.successfulMappings || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("mediaImport.mapped")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="text-2xl font-bold text-amber-600">
                      {importJob?.failedMappings || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("mediaImport.unmapped")}
                    </div>
                  </div>
                </div>

                {state.uploadErrors.length > 0 && (
                  <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-left">
                    <div className="font-medium text-destructive mb-2">
                      Upload Errors
                    </div>
                    <ul className="text-sm text-destructive space-y-1 max-h-32 overflow-y-auto">
                      {state.uploadErrors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-3">
                  {(importJob?.failedMappings || 0) > 0 && (
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-500"
                      onClick={() =>
                        setState((s) => ({ ...s, step: "review-unmapped" }))
                      }
                    >
                      Review {importJob?.failedMappings} Unmapped Files
                    </Button>
                  )}
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={reset}>
                      {t("csvImport.importMore")}
                    </Button>
                    <Button
                      asChild
                      className="bg-indigo-600 hover:bg-indigo-500"
                    >
                      <Link href="/collections">
                        {t("csvImport.viewCollections")}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {state.step === "review-unmapped" && state.jobId && (
              <UnmappedFilesReview
                jobId={state.jobId}
                onComplete={() => setState((s) => ({ ...s, step: "complete" }))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnmappedFilesReview({
  jobId,
  onComplete,
}: { jobId: Id<"importJobs">; onComplete: () => void }) {
  const t = useScopedI18n("collections");
  const unmappedFiles = useQuery(api.mediaImports.getUnmappedFiles, { jobId });
  const mapFile = useMutation(api.mediaImports.mapFileToCollection);
  const deleteFile = useMutation(api.mediaImports.deleteUnmappedFile);
  const { currentOrganizationId } = useOrganization();

  const [handledFiles, setHandledFiles] = useState<Set<string>>(new Set());

  if (!unmappedFiles) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const remainingFiles = unmappedFiles.filter(
    (f) => !handledFiles.has(f.storageId),
  );

  if (remainingFiles.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="mx-auto mb-4 size-12 text-green-500" />
        <h3 className="text-lg font-medium">
          {t("mediaImport.allFilesHandled")}
        </h3>
        <Button onClick={onComplete} className="mt-4">
          {t("mediaImport.backToSummary")}
        </Button>
      </div>
    );
  }

  const handleMap = async (storageId: Id<"_storage">, collectionId: string) => {
    try {
      await mapFile({
        jobId,
        storageId,
        collectionId: collectionId as Id<"collections">,
      });
      setHandledFiles((prev) => new Set(prev).add(storageId));
    } catch (err) {
      console.error("Failed to map file", err);
      alert("Failed to map file");
    }
  };

  const handleDelete = async (storageId: Id<"_storage">) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      await deleteFile({ jobId, storageId });
      setHandledFiles((prev) => new Set(prev).add(storageId));
    } catch (err) {
      console.error("Failed to delete file", err);
      alert("Failed to delete file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {t("mediaImport.reviewTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {remainingFiles.length} files need attention
          </p>
        </div>
        <Button variant="outline" onClick={onComplete}>
          Finish Review
        </Button>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-[400px]">Map to Object</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remainingFiles.map((file) => (
              <TableRow key={file.storageId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-muted-foreground" />
                    {file.fileName}
                  </div>
                  {file.error && (
                    <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {file.error}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                </TableCell>
                <TableCell>
                  <ObjectCombobox
                    organizationId={currentOrganizationId ?? undefined}
                    placeholder={t("mediaImport.searchObjectPlaceholder")}
                    onValueChange={(val) =>
                      val && handleMap(file.storageId, val)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(file.storageId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
