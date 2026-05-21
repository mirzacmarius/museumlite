"use client";

import { Button } from "@v1/ui/button";
import { Archive, Save } from "lucide-react";

interface ObjectRequestFormFooterProps {
  error: string | null;
  isSubmitting: boolean;
  isSavingDraft: boolean;
  hasSavedFieldDraft: boolean;
  hasLocalMediaSelections: boolean;
  isFormDirty: boolean;
  isDraftCurrent: boolean;
  selectedFileCount: number;
  selectedDocumentCount: number;
  resolvedBackHref: string;
  common: (key: string) => string;
  onNavigate: (href: string) => void;
  onSaveDraft: () => void;
}

export function ObjectRequestFormFooter({
  error,
  isSubmitting,
  isSavingDraft,
  hasSavedFieldDraft,
  hasLocalMediaSelections,
  isFormDirty,
  isDraftCurrent,
  selectedFileCount,
  selectedDocumentCount,
  resolvedBackHref,
  common,
  onNavigate,
  onSaveDraft,
}: ObjectRequestFormFooterProps) {
  const hasUploads = selectedFileCount > 0 || selectedDocumentCount > 0;

  return (
    <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : isSubmitting ? (
            <span className="text-foreground">
              {hasUploads ? "Submitting and uploading" : "Submitting"}
            </span>
          ) : isSavingDraft ? (
            <span className="text-foreground">Saving draft…</span>
          ) : hasSavedFieldDraft && isFormDirty ? (
            <span className="text-foreground">
              Draft exists, but your latest field changes are not saved yet.
            </span>
          ) : hasLocalMediaSelections ? (
            <span className="text-muted-foreground">
              Draft saves field data only. Images and documents stay local until
              you submit the object request.
            </span>
          ) : isDraftCurrent ? (
            <span className="text-muted-foreground">Draft saved.</span>
          ) : isFormDirty ? (
            <span className="text-foreground">
              You have unsaved field changes across tabs.
            </span>
          ) : (
            <span className="text-muted-foreground">
              No draft changes pending.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onSaveDraft()}
            disabled={isSavingDraft || isSubmitting}
          >
            <Archive className="mr-2 size-4" />
            {isSavingDraft ? "Saving draft..." : "Save Draft"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onNavigate(resolvedBackHref)}
          >
            {common("cancel")}
          </Button>
          <Button
            type="submit"
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
      </div>
    </div>
  );
}
