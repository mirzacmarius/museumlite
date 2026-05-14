"use client";

import { Loader2, Save, X } from "lucide-react";
import type * as React from "react";
import { cn } from "../utils";
import { Button } from "./button";

interface StickyFormFooterProps {
  onSave?: () => void;
  onCancel?: () => void;
  onSaveAndNew?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  saveAndNewLabel?: string;
  showSaveAndNew?: boolean;
  disabled?: boolean;
  className?: string;
  saveButtonProps?: React.ComponentPropsWithoutRef<typeof Button>;
}

export function StickyFormFooter({
  onSave,
  onCancel,
  onSaveAndNew,
  isSaving = false,
  isDirty = true,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  saveAndNewLabel = "Save & Add Another",
  showSaveAndNew = false,
  disabled = false,
  className,
  saveButtonProps,
}: StickyFormFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="mr-1 size-4" />
              {cancelLabel}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showSaveAndNew && onSaveAndNew && (
            <Button
              type="button"
              variant="outline"
              onClick={onSaveAndNew}
              disabled={isSaving || disabled || !isDirty}
            >
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {saveAndNewLabel}
            </Button>
          )}

          <Button
            type={onSave ? "button" : "submit"}
            onClick={onSave}
            disabled={isSaving || disabled || !isDirty}
            {...saveButtonProps}
          >
            {isSaving ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {isSaving ? "Saving..." : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
