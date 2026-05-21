"use client";

import { X } from "lucide-react";

export function TypeComboboxSelectedBadge({
  type,
  onRemove,
}: {
  type: string;
  onRemove: (type: string) => void;
}) {
  return (
    <div
      role="listitem"
      className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.stopPropagation();
        }
      }}
    >
      <span>{type}</span>
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(type);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
            event.preventDefault();
            onRemove(type);
          }
        }}
        className="cursor-pointer hover:text-destructive"
        aria-label={`Remove ${type}`}
      >
        <X className="size-3" />
      </span>
    </div>
  );
}

export function formatTypeName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
