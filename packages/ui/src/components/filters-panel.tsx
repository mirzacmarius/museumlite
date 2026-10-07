"use client";

import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import * as React from "react";
import { formatUiMessage, useUiLocale } from "../locale";
import { cn } from "../utils";
import { Button } from "./button";

interface FiltersPanelProps {
  children: React.ReactNode;
  title?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hasActiveFilters?: boolean;
  activeFilterCount?: number;
  onClear?: () => void;
  className?: string;
}

export function FiltersPanel({
  children,
  title,
  isOpen: controlledOpen,
  onOpenChange,
  hasActiveFilters = false,
  activeFilterCount,
  onClear,
  className,
}: FiltersPanelProps) {
  const { messages } = useUiLocale();
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Filter className="size-4" />
          {title ?? messages.filters.title}
          {hasActiveFilters &&
            activeFilterCount !== undefined &&
            activeFilterCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          {isOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>

        {hasActiveFilters && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            {messages.filters.clearAll}
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface FilterGroupProps {
  children: React.ReactNode;
  label: string;
  className?: string;
}

export function FilterGroup({ children, label, className }: FilterGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

interface FilterRowProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterRow({ children, className }: FilterRowProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

interface ActiveFilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export function ActiveFilterChip({
  label,
  value,
  onRemove,
}: ActiveFilterChipProps) {
  const { messages } = useUiLocale();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-full p-0.5 hover:bg-primary/20"
        aria-label={formatUiMessage(messages.filters.removeFilter, { label })}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

interface ActiveFiltersBarProps {
  children: React.ReactNode;
  className?: string;
}

export function ActiveFiltersBar({
  children,
  className,
}: ActiveFiltersBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}
