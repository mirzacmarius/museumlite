"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { ImportAccessionsStepPanels } from "./import-accessions-step-panels";
import {
  EMPTY_IMPORT_STATE,
  type ImportState,
} from "./import-accessions-types";
import { useImportAccessions } from "./use-import-accessions";

export function ImportAccessionsPageClient() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("accessions");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>(EMPTY_IMPORT_STATE);

  const {
    run,
    handleFileSelect,
    handleSaveMappings,
    handleContinueAfterValidation,
    handleStartImport,
    handleReset,
    downloadTemplate,
    onBackToMapping,
    onBackToValidation,
  } = useImportAccessions({
    currentOrganizationId,
    state,
    setState,
    fileInputRef,
  });

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accessions">
                <ArrowLeft className="mr-2 size-4" />
                {t("backToAccessions")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" />
              {t("import.downloadTemplate")}
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <ImportAccessionsStepPanels
              state={state}
              t={t}
              run={run}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
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
