"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import type { RefObject } from "react";
import { useScopedI18n } from "@/locales/client";

interface ImportUploadStepProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImportUploadStep({
  fileInputRef,
  onFileSelect,
}: ImportUploadStepProps) {
  const t = useScopedI18n("locations");

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <FileSpreadsheet className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{t("importTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("importDescription")}
        </p>
      </div>

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
        <p className="font-medium">{t("dropCSVHere")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("maxRows")}</p>
      </button>

      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="mb-2 font-medium">{t("csvFormatRequirements")}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <strong>{t("requiredColumns")}:</strong> name, locationCode, type
          </li>
          <li>
            <strong>{t("optionalColumns")}:</strong> parentLocation, address,
            capacity, notes
          </li>
          <li>
            <strong>{t("types")}:</strong> building, floor, room, gallery,
            storage, cabinet, shelf, drawer
          </li>
          <li>
            <strong>{t("parentReference")}:</strong>{" "}
            {t("parentReferenceDescription")}
          </li>
        </ul>
      </div>
    </div>
  );
}
