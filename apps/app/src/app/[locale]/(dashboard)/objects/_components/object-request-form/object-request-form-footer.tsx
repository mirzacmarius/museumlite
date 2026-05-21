"use client";

import { Button } from "@v1/ui/button";
import { Archive, Save } from "lucide-react";
import { createContext, type ReactNode, use, useMemo } from "react";

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

interface ObjectRequestFormFooterContextValue {
  phase: ObjectRequestFormFooterPhase;
  draft: ObjectRequestFormFooterDraft;
  dirty: boolean;
  resolvedBackHref: string;
  common: (key: string) => string;
  onNavigate: (href: string) => void;
  onSaveDraft: () => void;
}

const ObjectRequestFormFooterContext =
  createContext<ObjectRequestFormFooterContextValue | null>(null);

function useObjectRequestFormFooter() {
  const context = use(ObjectRequestFormFooterContext);
  if (!context) {
    throw new Error(
      "ObjectRequestFormFooter subcomponents must be used within ObjectRequestFormFooter",
    );
  }
  return context;
}

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
  dirty: boolean;
  resolvedBackHref: string;
  common: (key: string) => string;
  onNavigate: (href: string) => void;
  onSaveDraft: () => void;
  children?: ReactNode;
}

function ObjectRequestFormFooterProvider({
  phase,
  draft,
  dirty,
  resolvedBackHref,
  common,
  onNavigate,
  onSaveDraft,
  children,
}: ObjectRequestFormFooterProps) {
  const value = useMemo(
    () => ({
      phase,
      draft,
      dirty,
      resolvedBackHref,
      common,
      onNavigate,
      onSaveDraft,
    }),
    [phase, draft, dirty, resolvedBackHref, common, onNavigate, onSaveDraft],
  );

  return (
    <ObjectRequestFormFooterContext.Provider value={value}>
      <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {children ?? (
            <>
              <ObjectRequestFormFooter.DraftStatus />
              <ObjectRequestFormFooter.Actions />
            </>
          )}
        </div>
      </div>
    </ObjectRequestFormFooterContext.Provider>
  );
}

function ObjectRequestFormFooterDraftStatus() {
  const { phase, draft } = useObjectRequestFormFooter();

  return (
    <div className="text-sm">
      {phase.kind === "error" ? (
        <span className="text-destructive">{phase.message}</span>
      ) : phase.kind === "submitting" ? (
        <span className="text-foreground">
          {phase.hasUploads ? "Submitting and uploading" : "Submitting"}
        </span>
      ) : phase.kind === "saving-draft" ? (
        <span className="text-foreground">Saving draft…</span>
      ) : draft.kind === "stale" ? (
        <span className="text-foreground">
          Draft exists, but your latest field changes are not saved yet.
        </span>
      ) : draft.kind === "local-media" ? (
        <span className="text-muted-foreground">
          Draft saves field data only. Images and documents stay local until you
          submit the object request.
        </span>
      ) : draft.kind === "saved" ? (
        <span className="text-muted-foreground">Draft saved.</span>
      ) : draft.kind === "dirty" ? (
        <span className="text-foreground">
          You have unsaved field changes across tabs.
        </span>
      ) : (
        <span className="text-muted-foreground">No draft changes pending.</span>
      )}
    </div>
  );
}

function ObjectRequestFormFooterActions() {
  const { phase, onSaveDraft } = useObjectRequestFormFooter();
  const isBusy = phase.kind === "submitting" || phase.kind === "saving-draft";
  const isSavingDraft = phase.kind === "saving-draft";

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => void onSaveDraft()}
        disabled={isBusy}
      >
        <Archive className="mr-2 size-4" />
        {isSavingDraft ? "Saving draft..." : "Save Draft"}
      </Button>
      <ObjectRequestFormFooter.Submit />
    </div>
  );
}

function ObjectRequestFormFooterSubmit() {
  const { phase, resolvedBackHref, common, onNavigate } =
    useObjectRequestFormFooter();
  const isSubmitting = phase.kind === "submitting";
  const hasUploads = phase.kind === "submitting" && phase.hasUploads;

  return (
    <>
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
    </>
  );
}

export const ObjectRequestFormFooter = Object.assign(
  ObjectRequestFormFooterProvider,
  {
    DraftStatus: ObjectRequestFormFooterDraftStatus,
    Actions: ObjectRequestFormFooterActions,
    Submit: ObjectRequestFormFooterSubmit,
  },
);
