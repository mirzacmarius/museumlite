"use client";

import { Check, RotateCcw, RotateCw, Save, X } from "lucide-react";
import type { MediaEditorImage } from "./media-editor-types";

interface MediaEditorToolbarProps {
  image: MediaEditorImage;
  hasCrop: boolean;
  isSaving: boolean;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onApplyCrop: () => void;
  onSave: () => void;
  onClose: () => void;
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
}: MediaEditorToolbarProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-card/40 border-b border-border/60 backdrop-blur-xl p-4">
      <div className="flex items-center gap-4">
        {image.title && (
          <span className="text-sm font-medium text-foreground">
            Editing: {image.title}
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
          aria-label="Rotate left"
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
          aria-label="Rotate right"
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
            aria-label="Apply crop"
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
          aria-label="Save"
        >
          <Save size={20} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded-lg p-2 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
