"use client";

import { ChevronsUpDown, X } from "lucide-react";

interface DonorComboboxTriggerProps {
  disabled: boolean;
  placeholder: string;
  selectedValues: string[];
  inputValue: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onRemove: (donor: string) => void;
  onEnterKey: () => void;
}

export function DonorComboboxTrigger({
  disabled,
  placeholder,
  selectedValues,
  inputValue,
  open,
  onOpenChange,
  onInputChange,
  onRemove,
  onEnterKey,
}: DonorComboboxTriggerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 w-full min-h-[2.25rem] rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
      onClick={() => !disabled && onOpenChange(true)}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) {
          return;
        }
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onOpenChange(true);
        }
      }}
    >
      {selectedValues.map((donor) => (
        <div
          key={donor}
          className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
            }
          }}
        >
          <span>{donor}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(donor);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onRemove(donor);
              }
            }}
            className="hover:text-destructive cursor-pointer"
            aria-label={`Remove ${donor}`}
          >
            <X className="size-3" />
          </span>
        </div>
      ))}

      <input
        type="text"
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
        placeholder={
          selectedValues.length === 0 ? placeholder : "Search or add..."
        }
        value={inputValue}
        onChange={(e) => {
          onInputChange(e.target.value);
          if (!open && e.target.value.trim()) {
            onOpenChange(true);
          }
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && inputValue.trim()) {
            e.preventDefault();
            onEnterKey();
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(true);
        }}
        onFocus={() => {
          if (inputValue.trim()) {
            onOpenChange(true);
          }
        }}
        disabled={disabled}
      />

      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
    </div>
  );
}
