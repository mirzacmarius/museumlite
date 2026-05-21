"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { ImportObjectsStepPanels } from "./import-objects-step-panels";
import type { ImportState } from "./import-objects-types";
import { useImportObjects } from "./use-import-objects";

export function ImportObjectsPageClient() {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>({
    step: "upload",
    file: null,
    rawData: [],
    sourceFields: [],
    fieldMappings: [],
    selectedTemplate: null,
    rows: [],
    validationErrors: [],
    errors: [],
    jobId: null,
  });

  const {
    handleFileSelect,
    handleSaveMappings,
    handleContinueAfterValidation,
    handleStartImport,
    handleTemplateSelect,
    getInitialMappings,
    handleReset,
    downloadTemplate,
    onBackToMapping,
    onBackToValidation,
  } = useImportObjects({
    currentOrganizationId,
    state,
    setState,
    fileInputRef,
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationImport")}</p>
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
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("csvImport.downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <ImportObjectsStepPanels
              state={state}
              t={t}
              common={common}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              handleTemplateSelect={handleTemplateSelect}
              getInitialMappings={getInitialMappings}
              handleSaveMappings={handleSaveMappings}
              handleReset={handleReset}
              handleContinueAfterValidation={handleContinueAfterValidation}
              handleStartImport={handleStartImport}
              onBackToMapping={onBackToMapping}
              onBackToValidation={onBackToValidation}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
