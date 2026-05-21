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
      role="combobox"
      aria-expanded={open}
      tabIndex={disabled ? -1 : 0}
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
        <span
          key={donor}
          className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
        >
          <span>{donor}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(donor);
            }}
            className="hover:text-destructive cursor-pointer"
            aria-label={`Remove ${donor}`}
          >
            <X className="size-3" />
          </button>
        </span>
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
