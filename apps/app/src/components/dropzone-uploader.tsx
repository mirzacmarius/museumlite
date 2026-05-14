"use client";

import { cn } from "@v1/ui/utils";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Upload,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

export interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

interface DropzoneUploaderProps {
  accept?: string;
  multiple?: boolean;
  maxSizeBytes?: number;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  uploadingFiles?: UploadFile[];
  disabled?: boolean;
  className?: string;
  label?: string;
  sublabel?: string;
}

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;
const DEFAULT_MAX_FILES = 20;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="size-4" />;
  }
  if (mimeType.startsWith("video/")) {
    return <FileVideo className="size-4" />;
  }
  return <FileText className="size-4" />;
}

export function DropzoneUploader({
  accept = "image/*,video/*,.pdf",
  multiple = true,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  onFilesSelected,
  uploadingFiles = [],
  disabled = false,
  className,
  label = "Drop files here or click to upload",
  sublabel,
}: DropzoneUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      if (files.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed at once`);
        return { valid: [], errors };
      }

      const acceptPatterns = accept
        .split(",")
        .map((p) => p.trim().toLowerCase());

      for (const file of files) {
        if (file.size > maxSizeBytes) {
          errors.push(
            `${file.name} exceeds ${formatFileSize(maxSizeBytes)} limit`,
          );
          continue;
        }

        const fileType = file.type.toLowerCase();
        const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;

        const isAllowed = acceptPatterns.some((pattern) => {
          if (pattern.startsWith(".")) {
            return fileExtension === pattern;
          }
          if (pattern.endsWith("/*")) {
            const typePrefix = pattern.slice(0, -2);
            return fileType.startsWith(typePrefix);
          }
          return fileType === pattern;
        });

        if (!isAllowed) {
          errors.push(`${file.name} has an unsupported file type`);
          continue;
        }

        valid.push(file);
      }

      return { valid, errors };
    },
    [accept, maxSizeBytes, maxFiles],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setValidationErrors([]);
      const fileArray = Array.from(files);
      const { valid, errors } = validateFiles(fileArray);

      if (errors.length > 0) {
        setValidationErrors(errors);
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [validateFiles, onFilesSelected],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles],
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFiles],
  );

  const hasActiveUploads = uploadingFiles.some(
    (f) => f.status === "uploading" || f.status === "pending",
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-50",
          hasActiveUploads && "pointer-events-none opacity-70",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {hasActiveUploads ? (
          <Loader2 className="mb-2 size-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload
            className={cn(
              "mb-2 size-8",
              isDragOver ? "text-primary" : "text-muted-foreground",
            )}
          />
        )}

        <p
          className={cn(
            "text-sm font-medium",
            isDragOver ? "text-primary" : "text-foreground",
          )}
        >
          {hasActiveUploads ? "Uploading..." : label}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {sublabel || `Up to ${formatFileSize(maxSizeBytes)} per file`}
        </p>
      </div>

      {validationErrors.length > 0 && (
        <div className="space-y-1">
          {validationErrors.map((error) => (
            <div
              key={error}
              className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="size-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              <div className="flex-shrink-0">
                {upload.status === "complete" ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : upload.status === "error" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : upload.status === "uploading" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  getFileIcon(upload.file.type)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {upload.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(upload.file.size)}
                  {upload.error && (
                    <span className="ml-2 text-destructive">
                      {upload.error}
                    </span>
                  )}
                </p>
              </div>

              {upload.status === "uploading" && (
                <div className="w-20">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {upload.status === "complete" && (
                <span className="text-xs text-green-500">Done</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
