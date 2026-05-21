"use client";

import { FormStickyFooter } from "@/components/form-sticky-footer";
import { Button } from "@v1/ui/button";
import { Archive, Save } from "lucide-react";

export type ObjectRequestFormFooterPhase =
  | { kind: "error"; message: string }
  | { kind: "submitting"; hasUploads: boolean }
  | { kind: "saving-draft" }
  | { kind: "idle" };

export type ObjectRequestFormFooterDraft =
  | { kind: "stale" }
  | { kind: "local-media" }
  | { kind: "saved" }
  | { kind: "dirty" }
  | { kind: "none" };

export function resolveObjectRequestFormFooterPhase({
  error,
  isSubmitting,
  isSavingDraft,
  hasUploads,
}: {
  error: string | null;
  isSubmitting: boolean;
  isSavingDraft: boolean;
  hasUploads: boolean;
}): ObjectRequestFormFooterPhase {
  if (error) return { kind: "error", message: error };
  if (isSubmitting) return { kind: "submitting", hasUploads };
  if (isSavingDraft) return { kind: "saving-draft" };
  return { kind: "idle" };
}

export function resolveObjectRequestFormFooterDraft({
  hasSavedFieldDraft,
  hasLocalMediaSelections,
  isDraftCurrent,
  isFormDirty,
}: {
  hasSavedFieldDraft: boolean;
  hasLocalMediaSelections: boolean;
  isDraftCurrent: boolean;
  isFormDirty: boolean;
}): ObjectRequestFormFooterDraft {
  if (hasSavedFieldDraft && isFormDirty) return { kind: "stale" };
  if (hasLocalMediaSelections) return { kind: "local-media" };
  if (isDraftCurrent) return { kind: "saved" };
  if (isFormDirty) return { kind: "dirty" };
  return { kind: "none" };
}

interface ObjectRequestFormFooterProps {
  phase: ObjectRequestFormFooterPhase;
  draft: ObjectRequestFormFooterDraft;
  resolvedBackHref: string;
  common: (key: string) => string;
  onNavigate: (href: string) => void;
  onSaveDraft: () => void;
}

function renderObjectRequestFormFooterStatus(
  phase: ObjectRequestFormFooterPhase,
  draft: ObjectRequestFormFooterDraft,
) {
  switch (phase.kind) {
    case "error":
      return <span className="text-destructive">{phase.message}</span>;
    case "submitting":
      return (
        <span className="text-foreground">
          {phase.hasUploads ? "Submitting and uploading" : "Submitting"}
        </span>
      );
    case "saving-draft":
      return <span className="text-foreground">Saving draft…</span>;
    case "idle":
      switch (draft.kind) {
        case "stale":
          return (
            <span className="text-foreground">
              Draft exists, but your latest field changes are not saved yet.
            </span>
          );
        case "local-media":
          return (
            <span className="text-muted-foreground">
              Draft saves field data only. Images and documents stay local until
              you submit the object request.
            </span>
          );
        case "saved":
          return (
            <span className="text-muted-foreground">Draft saved.</span>
          );
        case "dirty":
          return (
            <span className="text-foreground">
              You have unsaved field changes across tabs.
            </span>
          );
        case "none":
          return (
            <span className="text-muted-foreground">
              No draft changes pending.
            </span>
          );
      }
  }
}

export function ObjectRequestFormFooter({
  phase,
  draft,
  resolvedBackHref,
  common,
  onNavigate,
  onSaveDraft,
}: ObjectRequestFormFooterProps) {
  const isBusy = phase.kind === "submitting" || phase.kind === "saving-draft";
  const isSavingDraft = phase.kind === "saving-draft";
  const isSubmitting = phase.kind === "submitting";
  const hasUploads = phase.kind === "submitting" && phase.hasUploads;

  return (
    <FormStickyFooter>
      <FormStickyFooter.Status>
        {renderObjectRequestFormFooterStatus(phase, draft)}
      </FormStickyFooter.Status>
      <FormStickyFooter.Actions>
        <Button
          type="button"
          variant="outline"
          onClick={() => void onSaveDraft()}
          disabled={isBusy}
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
        <Button type="submit" form="object-create-form" disabled={isSubmitting}>
          <Save className="mr-2 size-4" />
          {isSubmitting
            ? hasUploads
              ? "Submitting and uploading"
              : "Submitting"
            : "Submit for Approval"}
        </Button>
      </FormStickyFooter.Actions>
    </FormStickyFooter>
  );
}
