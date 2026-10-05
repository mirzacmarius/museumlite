"use client";

import { AlertCircle, FileSpreadsheet, Upload } from "lucide-react";
import type { RefObject } from "react";

interface ImportAccessionsUploadStepProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: string[];
}

export function ImportAccessionsUploadStep({
  t,
  fileInputRef,
  onFileSelect,
  errors,
}: ImportAccessionsUploadStepProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t("import.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("import.description")}
        </p>
      </div>

      {errors.length > 0 ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errors.join(" ")}</span>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={onFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-all hover:border-primary/50 hover:bg-muted/30"
      >
        <Upload className="mb-4 size-10 text-muted-foreground" />
        <p className="font-medium">{t("import.dropZone")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("import.maxRows")}
        </p>
      </button>

      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-2 font-medium">{t("import.formatTitle")}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            • <strong>{t("import.required")}</strong>{" "}
            {t("import.requiredFields")}
          </li>
          <li>
            • <strong>{t("import.optional")}</strong>{" "}
            {t("import.optionalFields")}
          </li>
          <li>
            • <strong>{t("import.methods")}</strong> {t("import.methodsList")}
          </li>
          <li>
            • <strong>{t("import.dateFormat")}</strong>{" "}
            {t("import.dateFormatHint")}
          </li>
        </ul>
      </div>
    </div>
  );
}
