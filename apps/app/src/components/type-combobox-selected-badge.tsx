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
    <span className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs">
      <span>{type}</span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(type);
        }}
        className="cursor-pointer hover:text-destructive"
        aria-label={`Remove ${type}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

export function formatTypeName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
