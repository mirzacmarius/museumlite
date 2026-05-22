"use client";

import { FormStickyFooter } from "@/components/form-sticky-footer";
import { Button } from "@v1/ui/button";
import { Save } from "lucide-react";

export type CollectionEditFormFooterState =
  | { kind: "submitting" }
  | { kind: "dirty" }
  | { kind: "media-only" }
  | { kind: "idle" };

export function resolveCollectionEditFormFooterState({
  isSubmitting,
  isFormDirty,
  hasMediaChanges,
}: {
  isSubmitting: boolean;
  isFormDirty: boolean;
  hasMediaChanges: boolean;
}): CollectionEditFormFooterState {
  if (isSubmitting) return { kind: "submitting" };
  if (isFormDirty) return { kind: "dirty" };
  if (hasMediaChanges) return { kind: "media-only" };
  return { kind: "idle" };
}

interface CollectionEditFormFooterProps {
  error: string | null;
  state: CollectionEditFormFooterState;
  canUpdateObject: boolean;
  collectionId: string;
  common: (key: string) => string;
  t: (key: string) => string;
  onNavigate: (href: string) => void;
}

function CollectionEditFormFooterStatus({
  error,
  state,
}: {
  error: string | null;
  state: CollectionEditFormFooterState;
}) {
  if (error) {
    return <span className="text-destructive">{error}</span>;
  }

  switch (state.kind) {
    case "submitting":
      return <span className="text-foreground">Saving changes…</span>;
    case "dirty":
      return (
        <span className="text-foreground">
          You have unsaved field changes across tabs.
        </span>
      );
    case "media-only":
      return (
        <span className="text-muted-foreground">
          Media changes are already applied.
        </span>
      );
    case "idle":
      return (
        <span className="text-muted-foreground">No unsaved field changes.</span>
      );
  }
}

export function CollectionEditFormFooter({
  error,
  state,
  canUpdateObject,
  collectionId,
  common,
  t,
  onNavigate,
}: CollectionEditFormFooterProps) {
  const isSubmitting = state.kind === "submitting";

  return (
    <FormStickyFooter>
      <FormStickyFooter.Status>
        <CollectionEditFormFooterStatus error={error} state={state} />
      </FormStickyFooter.Status>
      <FormStickyFooter.Actions>
        <Button
          type="button"
          variant="outline"
          onClick={() => onNavigate(`/objects/${collectionId}`)}
        >
          {common("cancel")}
        </Button>
        <Button
          type="submit"
          form="object-edit-form"
          disabled={isSubmitting || !canUpdateObject}
        >
          <Save className="mr-2 size-4" />
          {isSubmitting ? common("updating") : t("form.actions.updateObject")}
        </Button>
      </FormStickyFooter.Actions>
    </FormStickyFooter>
  );
}
