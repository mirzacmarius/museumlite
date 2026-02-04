"use client";

import { Slot } from "@radix-ui/react-slot";
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { Button } from "./button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface FiltersDropdownProps {
  children: React.ReactNode;
  title?: string;
  hasActiveFilters?: boolean;
  activeFilterCount?: number;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: React.ComponentProps<typeof PopoverContent>["align"];
  side?: React.ComponentProps<typeof PopoverContent>["side"];
}

export function FiltersDropdown({
  children,
  title = "Filters",
  hasActiveFilters = false,
  activeFilterCount,
  className,
  triggerClassName,
  contentClassName,
  align = "start",
  side = "bottom",
}: FiltersDropdownProps) {
  return (
    <Popover>
      <div className={cn("inline-flex", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 border-white/10 bg-zinc-950/40 text-zinc-200 hover:bg-zinc-900 hover:text-zinc-100",
              triggerClassName,
            )}
          >
            <span className="flex items-center gap-2">
              <span>{title}</span>
              {hasActiveFilters &&
                activeFilterCount !== undefined &&
                activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-none text-white">
                    {activeFilterCount}
                  </span>
                )}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={align}
          side={side}
          sideOffset={8}
          className={cn(
            "w-[22rem] overflow-hidden rounded-lg border border-white/10 bg-zinc-950 p-0 text-zinc-100 shadow-2xl shadow-black/40",
            contentClassName,
          )}
        >
          {children}
        </PopoverContent>
      </div>
    </Popover>
  );
}

export interface FiltersSearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function FiltersSearchInput({
  value,
  onValueChange,
  placeholder = "Search",
  className,
  autoFocus = true,
}: FiltersSearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={cn("p-2.5 pb-0", className)}>
      <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900/60 px-2 py-1.5 text-xs">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-zinc-200 outline-none placeholder:text-zinc-500"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        {value !== "" && (
          <button
            type="button"
            className="grid place-items-center rounded p-0.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            onClick={() => onValueChange("")}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export interface FilterSectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  className?: string;
}

export function FilterSection({
  title,
  children,
  count,
  defaultOpen = true,
  className,
}: FilterSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const countLabel = count !== undefined && count > 0 ? ` (${count})` : "";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="sticky top-0 flex w-full items-center justify-between gap-2 bg-zinc-950 px-2.5 py-2 text-left"
        >
          <div className="truncate text-xs font-medium text-zinc-400">
            {title}
            {countLabel}
          </div>
          <span className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2.5 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

type FilterSelectionKind = "multiple" | "single";

export interface FilterOptionRowProps {
  title: React.ReactNode;
  isChecked: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  kind?: FilterSelectionKind;
  disabled?: boolean;
  className?: string;
}

export function FilterOptionRow({
  title,
  isChecked,
  onClick,
  icon,
  kind = "multiple",
  disabled = false,
  className,
}: FilterOptionRowProps) {
  const indicatorShape = kind === "single" ? "rounded-full" : "rounded-sm";
  const role = kind === "single" ? "radio" : "checkbox";

  return (
    <button
      type="button"
      role={role}
      aria-checked={isChecked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors",
        "hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <div
        className={cn(
          "grid h-4 w-4 flex-shrink-0 place-items-center border border-white/10 bg-zinc-900/60",
          indicatorShape,
          isChecked && "border-indigo-500/50 bg-indigo-600 text-white",
        )}
      >
        {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon && (
          <div className="grid w-5 flex-shrink-0 place-items-center">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 truncate text-xs text-zinc-200">
          {title}
        </div>
      </div>
    </button>
  );
}

export interface AppliedFiltersBarProps {
  children: React.ReactNode;
  className?: string;
}

export function AppliedFiltersBar({
  children,
  className,
}: AppliedFiltersBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

export interface AppliedFilterChipProps {
  label: string;
  value?: string;
  onRemove: () => void;
  className?: string;
  asChild?: boolean;
}

export function AppliedFilterChip({
  label,
  value,
  onRemove,
  className,
  asChild = false,
}: AppliedFilterChipProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type="button"
      onClick={onRemove}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950/40 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900/60",
        className,
      )}
    >
      <span className="max-w-[10rem] truncate">
        <span className="text-zinc-400">{label}</span>
        {value ? <span className="text-zinc-500">: </span> : null}
        {value ? <span className="text-zinc-200">{value}</span> : null}
      </span>
      <span className="grid h-4 w-4 place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-300">
        <X className="h-3.5 w-3.5" />
      </span>
    </Comp>
  );
}
