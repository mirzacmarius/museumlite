"use client";

import {
  Check,
  Hourglass,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useI18n } from "@/locales/client";
import type {
  MediaEditorDeletion,
  MediaEditorImage,
} from "./media-editor-types";

interface MediaEditorToolbarProps {
  image: MediaEditorImage;
  hasCrop: boolean;
  isSaving: boolean;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onApplyCrop: () => void;
  onSave: () => void;
  onClose: () => void;
  deletion?: MediaEditorDeletion;
}

function DeletionControl({ deletion }: { deletion: MediaEditorDeletion }) {
  const translate = useI18n();
  if (deletion.pending) {
    return (
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-medium text-amber-700 sm:px-2.5 sm:py-1 dark:text-amber-300"
        title={translate("imageDeletion.pendingDescription")}
      >
        <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
        {/* Narrow toolbars keep the label for screen readers and the title. */}
        <span className="sr-only sm:not-sr-only">
          {translate("imageDeletion.pending")}
        </span>
      </span>
    );
  }
  if (deletion.marked) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          deletion.onKeep();
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 sm:px-2.5 sm:py-1 dark:text-amber-300"
        title={translate("imageDeletion.markedDescription")}
      >
        <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">
          {translate("imageDeletion.keepImage")}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        deletion.onDelete();
      }}
      className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
      aria-label={translate("imageDeletion.deleteImage")}
      title={translate("imageDeletion.deleteImage")}
    >
      <Trash2 size={20} />
    </button>
  );
}

export function MediaEditorToolbar({
  image,
  hasCrop,
  isSaving,
  onRotateLeft,
  onRotateRight,
  onApplyCrop,
  onSave,
  onClose,
  deletion,
}: MediaEditorToolbarProps) {
  const translate = useI18n();
  return (
    <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-card/40 border-b border-border/60 backdrop-blur-xl p-4">
      <div className="flex items-center gap-4">
        {image.title && (
          <span className="text-sm font-medium text-foreground">
            {translate("untranslatedComponents.labels.editing")} {image.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRotateLeft();
          }}
          className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label={translate("untranslatedComponents.labels.rotateLeft")}
        >
          <RotateCcw size={20} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRotateRight();
          }}
          className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label={translate("untranslatedComponents.labels.rotateRight")}
        >
          <RotateCw size={20} />
        </button>
        {hasCrop && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApplyCrop();
            }}
            className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
            aria-label={translate("untranslatedComponents.labels.applyCrop")}
          >
            <Check size={20} />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          disabled={isSaving}
          className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          aria-label={translate("untranslatedComponents.labels.save")}
        >
          <Save size={20} />
        </button>
        {deletion ? <DeletionControl deletion={deletion} /> : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label={translate("untranslatedComponents.labels.close")}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
