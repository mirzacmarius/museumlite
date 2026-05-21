"use client";

import { Button } from "@v1/ui/button";
import { Save } from "lucide-react";

interface CollectionEditFormFooterProps {
  error: string | null;
  isSubmitting: boolean;
  isFormDirty: boolean;
  hasMediaChanges: boolean;
  canUpdateObject: boolean;
  collectionId: string;
  common: (key: string) => string;
  t: (key: string) => string;
  onNavigate: (href: string) => void;
}

export function CollectionEditFormFooter({
  error,
  isSubmitting,
  isFormDirty,
  hasMediaChanges,
  canUpdateObject,
  collectionId,
  common,
  t,
  onNavigate,
}: CollectionEditFormFooterProps) {
  return (
    <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : isSubmitting ? (
            <span className="text-foreground">Saving changes…</span>
          ) : isFormDirty ? (
            <span className="text-foreground">
              You have unsaved field changes across tabs.
            </span>
          ) : hasMediaChanges ? (
            <span className="text-muted-foreground">
              Media changes are already applied.
            </span>
          ) : (
            <span className="text-muted-foreground">
              No unsaved field changes.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
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
        </div>
      </div>
    </div>
  );
}
