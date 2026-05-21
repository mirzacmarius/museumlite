"use client";

import { FileImage, FileSpreadsheet, Link as LinkIcon } from "lucide-react";

interface MediaImportSelectMappingStepProps {
  t: (key: string) => string;
  onMappingSelect: (type: "csv" | "filename" | "manual") => void;
}

export function MediaImportSelectMappingStep({
  t,
  onMappingSelect,
}: MediaImportSelectMappingStepProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-8 text-center text-2xl font-semibold">
        {t("mediaImport.mappingTitle")}
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        <button
          type="button"
          className="rounded-lg border border-border bg-card text-card-foreground shadow-sm cursor-pointer p-6 transition-all hover:border-primary/50 hover:bg-muted/30 text-left"
          onClick={() => onMappingSelect("csv")}
        >
          <FileSpreadsheet className="mb-4 size-10 text-primary" />
          <h3 className="mb-2 font-medium">{t("mediaImport.csvMapping")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("mediaImport.csvMappingDescription")}
          </p>
        </button>

        <button
          type="button"
          className="rounded-lg border border-border bg-card text-card-foreground shadow-sm cursor-pointer p-6 transition-all hover:border-primary/50 hover:bg-muted/30 text-left"
          onClick={() => onMappingSelect("filename")}
        >
          <FileImage className="mb-4 size-10 text-primary" />
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
          onClick={() => onMappingSelect("manual")}
        >
          <LinkIcon className="mb-4 size-10 text-primary" />
          <h3 className="mb-2 font-medium">{t("mediaImport.manualMapping")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("mediaImport.manualMappingDescription")}
          </p>
        </button>
      </div>
    </div>
  );
}
