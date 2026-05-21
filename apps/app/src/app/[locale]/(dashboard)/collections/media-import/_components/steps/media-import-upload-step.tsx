"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import { FileImage, FileSpreadsheet, Trash2, Upload, X } from "lucide-react";
import type { RefObject } from "react";
import { PermissionGate } from "@/components/permission-gate";
import type { MediaImportState } from "../media-import-types";

interface MediaImportUploadStepProps {
  state: MediaImportState;
  t: (key: string) => string;
  common: (key: string) => string;
  mediaInputRef: RefObject<HTMLInputElement | null>;
  csvInputRef: RefObject<HTMLInputElement | null>;
  onCsvSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMediaSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMediaFile: (index: number) => void;
  onStartImport: () => void;
  onReset: () => void;
  onClearCsvFile: () => void;
  onClearMediaFiles: () => void;
}

export function MediaImportUploadStep({
  state,
  t,
  common,
  mediaInputRef,
  csvInputRef,
  onCsvSelect,
  onMediaSelect,
  onRemoveMediaFile,
  onStartImport,
  onReset,
  onClearCsvFile,
  onClearMediaFiles,
}: MediaImportUploadStepProps) {
  return (
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
                <FileSpreadsheet className="size-6" />
                <span className="font-medium">{state.csvFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCsvFile();
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Drop CSV file here</p>
              </>
            )}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onCsvSelect}
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
            onChange={onMediaSelect}
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
                onClick={onClearMediaFiles}
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
                    <FileImage className="size-4 text-muted-foreground shrink-0" />
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveMediaFile(i)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onReset}>
          {common("cancel")}
        </Button>
        <PermissionGate permission="media.upload">
          <Button
            onClick={onStartImport}
            disabled={
              state.mediaFiles.length === 0 ||
              (state.mappingType === "csv" && !state.csvFile)
            }
            className="bg-primary hover:bg-primary/90"
          >
            {t("mediaImport.startImport")}
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
}
