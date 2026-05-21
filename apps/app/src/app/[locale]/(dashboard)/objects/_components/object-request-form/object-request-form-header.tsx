"use client";

import { Button } from "@v1/ui/button";
import { Archive, ArrowLeft, Save } from "lucide-react";

interface ObjectRequestFormHeaderProps {
  t: (key: string) => string;
  common: (key: string) => string;
  pageTitle: string;
  resolvedBackHref: string;
  isSubmitting: boolean;
  isSavingDraft: boolean;
  selectedFileCount: number;
  selectedDocumentCount: number;
  onNavigate: (href: string) => void;
  onSaveDraft: () => void;
}

export function ObjectRequestFormHeader({
  t,
  common,
  pageTitle,
  resolvedBackHref,
  isSubmitting,
  isSavingDraft,
  selectedFileCount,
  selectedDocumentCount,
  onNavigate,
  onSaveDraft,
}: ObjectRequestFormHeaderProps) {
  const hasUploads = selectedFileCount > 0 || selectedDocumentCount > 0;

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onNavigate(resolvedBackHref)}
        >
          <ArrowLeft className="size-4 text-muted-foreground" />
        </Button>
        <span className="text-muted-foreground">{t("detail.collections")}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium text-foreground">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onSaveDraft()}
          disabled={isSavingDraft || isSubmitting}
        >
          <Archive className="mr-2 size-4" />
          {isSavingDraft ? "Saving draft..." : "Save Draft"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigate(resolvedBackHref)}
        >
          {common("cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          form="object-create-form"
          disabled={isSubmitting}
        >
          <Save className="mr-2 size-4" />
          {isSubmitting
            ? hasUploads
              ? "Submitting and uploading"
              : "Submitting"
            : "Submit for Approval"}
        </Button>
      </div>
    </header>
  );
}
