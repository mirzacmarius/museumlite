"use client";

import { Button } from "@v1/ui/button";
import { Save } from "lucide-react";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export type CollectionEditFormFooterState =
  | { kind: "submitting" }
  | { kind: "dirty" }
  | { kind: "media-only" }
  | { kind: "idle" };

interface CollectionEditFormFooterContextValue {
  error: string | null;
  state: CollectionEditFormFooterState;
  canUpdateObject: boolean;
  collectionId: string;
  common: (key: string) => string;
  t: (key: string) => string;
  onNavigate: (href: string) => void;
}

const CollectionEditFormFooterContext =
  createContext<CollectionEditFormFooterContextValue | null>(null);

function useCollectionEditFormFooter() {
  const context = useContext(CollectionEditFormFooterContext);
  if (!context) {
    throw new Error(
      "CollectionEditFormFooter subcomponents must be used within CollectionEditFormFooter",
    );
  }
  return context;
}

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
  children?: ReactNode;
}

function CollectionEditFormFooterProvider({
  error,
  state,
  canUpdateObject,
  collectionId,
  common,
  t,
  onNavigate,
  children,
}: CollectionEditFormFooterProps) {
  const value = useMemo(
    () => ({
      error,
      state,
      canUpdateObject,
      collectionId,
      common,
      t,
      onNavigate,
    }),
    [error, state, canUpdateObject, collectionId, common, t, onNavigate],
  );

  return (
    <CollectionEditFormFooterContext.Provider value={value}>
      <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {children ?? (
            <>
              <CollectionEditFormFooter.Status />
              <CollectionEditFormFooter.Actions />
            </>
          )}
        </div>
      </div>
    </CollectionEditFormFooterContext.Provider>
  );
}

function CollectionEditFormFooterStatus() {
  const { error, state } = useCollectionEditFormFooter();

  return (
    <div className="text-sm">
      {error ? (
        <span className="text-destructive">{error}</span>
      ) : state.kind === "submitting" ? (
        <span className="text-foreground">Saving changes…</span>
      ) : state.kind === "dirty" ? (
        <span className="text-foreground">
          You have unsaved field changes across tabs.
        </span>
      ) : state.kind === "media-only" ? (
        <span className="text-muted-foreground">
          Media changes are already applied.
        </span>
      ) : (
        <span className="text-muted-foreground">
          No unsaved field changes.
        </span>
      )}
    </div>
  );
}

function CollectionEditFormFooterActions() {
  const { state, canUpdateObject, collectionId, common, t, onNavigate } =
    useCollectionEditFormFooter();
  const isSubmitting = state.kind === "submitting";

  return (
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
  );
}

export const CollectionEditFormFooter = Object.assign(
  CollectionEditFormFooterProvider,
  {
    Status: CollectionEditFormFooterStatus,
    Actions: CollectionEditFormFooterActions,
  },
);
