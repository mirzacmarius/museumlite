"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import type { RefObject } from "react";
import { ImportFileError } from "@/components/import/import-file-error";

import { useI18n } from "@/locales/client";

interface ImportObjectsUploadStepProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: string[];
}

export function ImportObjectsUploadStep({
  t,
  fileInputRef,
  onFileSelect,
  errors,
}: ImportObjectsUploadStepProps) {
  const tRoot = useI18n();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t("csvImport.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("csvImport.description")}
        </p>
      </div>

      <ImportFileError errors={errors} />

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
        <p className="font-medium">{t("csvImport.dropZone")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("csvImport.maxRows")}
        </p>
      </button>

      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-2 font-medium">{t("csvImport.formatTitle")}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>{tRoot("collections.csvImport.requiredLabel")}</strong>{" "}
            {tRoot("collections.csvImport.requiredValue")}
          </li>
          <li>
            <strong>
              {tRoot("collections.csvImport.identificationLabel")}
            </strong>{" "}
            {tRoot("collections.csvImport.identificationValue")}
          </li>
          <li>
            <strong>{tRoot("collections.csvImport.contextLabel")}</strong>{" "}
            {tRoot("collections.csvImport.contextValue")}
          </li>
          <li>
            <strong>{tRoot("collections.csvImport.physicalLabel")}</strong>{" "}
            {tRoot("collections.csvImport.physicalValue")}
          </li>
          <li>
            <strong>{tRoot("collections.csvImport.organizationLabel")}</strong>{" "}
            {tRoot("collections.csvImport.organizationValue")}
          </li>
          <li>
            <strong>{tRoot("collections.csvImport.documentationLabel")}</strong>{" "}
            {tRoot("collections.csvImport.documentationValue")}
          </li>
        </ul>
      </div>
    </div>
  );
}
