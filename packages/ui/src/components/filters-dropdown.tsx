"use client";

import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import * as React from "react";
import { useFocusOnLeave } from "../hooks/use-focus-on-leave";
import { formatUiMessage, useUiLocale } from "../locale";
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
  title,
  hasActiveFilters = false,
  activeFilterCount,
  className,
  triggerClassName,
  contentClassName,
  align = "start",
  side = "bottom",
}: FiltersDropdownProps) {
  const { messages } = useUiLocale();
  return (
    <Popover>
      <div className={cn("inline-flex", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 border-input bg-background/40 text-foreground hover:bg-accent hover:text-accent-foreground",
              triggerClassName,
            )}
          >
            <span className="flex items-center gap-2">
              <span>{title ?? messages.filters.title}</span>
              {hasActiveFilters &&
                activeFilterCount !== undefined &&
                activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
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
            "w-[22rem] overflow-hidden rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-2xl",
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
  placeholder,
  className,
  autoFocus = true,
}: FiltersSearchInputProps) {
  const { messages } = useUiLocale();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className={cn("p-2.5 pb-0", className)}>
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background/60 px-2 py-1.5 text-xs">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          placeholder={placeholder ?? messages.filters.search}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        {value !== "" && (
          <button
            type="button"
            className="grid place-items-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => onValueChange("")}
            aria-label={messages.filters.clearSearch}
          >
            <X className="size-3.5" />
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
  const [open, setOpen] = React.useState(() => defaultOpen);
  const countLabel = count !== undefined && count > 0 ? ` (${count})` : "";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="sticky top-0 flex w-full items-center justify-between gap-2 bg-popover px-2.5 py-2 text-left"
        >
          <div className="truncate text-xs font-medium text-muted-foreground">
            {title}
            {countLabel}
          </div>
          <span className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            {open ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
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

  return (
    <button
      type="button"
      aria-pressed={isChecked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors",
        "hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <div
        className={cn(
          "grid size-4 flex-shrink-0 place-items-center border border-border bg-background/60",
          indicatorShape,
          isChecked && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {isChecked && <Check className="size-3" strokeWidth={3} />}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon && (
          <div className="grid w-5 flex-shrink-0 place-items-center">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 truncate text-xs text-foreground">
          {title}
        </div>
      </div>
    </button>
  );
}

export interface AppliedFiltersBarProps {
  /** The applied filters, as `AppliedFilterChip`s. */
  children: React.ReactNode;
  /** Shows a Clear all button after the chips. */
  onClearAll?: () => void;
  /** Takes focus when the last filter is removed, e.g. the search box. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

const AppliedFiltersBarContext = React.createContext<{
  chipRemoved: (chip: HTMLElement) => void;
} | null>(null);

const CHIP_SELECTOR = "[data-applied-filter]";

/**
 * The filters applied to a list, each removable. Removing one keeps focus in
 * the bar on the chip that takes its place; removing the last closes the bar
 * and returns focus to `returnFocusRef`.
 */
export function AppliedFiltersBar({
  children,
  onClearAll,
  returnFocusRef,
  className,
}: AppliedFiltersBarProps) {
  const { messages } = useUiLocale();
  const barRef = React.useRef<HTMLDivElement>(null);
  const removedIndexRef = React.useRef<number | null>(null);
  const context = React.useMemo(
    () => ({
      chipRemoved: (chip: HTMLElement) => {
        const chips = barRef.current?.querySelectorAll(CHIP_SELECTOR) ?? [];
        removedIndexRef.current = Array.from(chips).indexOf(chip);
      },
    }),
    [],
  );

  // Once the removed chip has left the page, focus the one in its place.
  React.useLayoutEffect(() => {
    const bar = barRef.current;
    const removedIndex = removedIndexRef.current;
    if (!bar || removedIndex === null) return;
    if (bar.contains(document.activeElement)) return;
    removedIndexRef.current = null;
    const chips = bar.querySelectorAll<HTMLElement>(CHIP_SELECTOR);
    (chips[removedIndex] ?? chips[removedIndex - 1])?.focus();
  });
  useFocusOnLeave(barRef, returnFocusRef);

  return (
    <AppliedFiltersBarContext.Provider value={context}>
      <div
        ref={barRef}
        className={cn("flex flex-wrap items-center gap-2", className)}
      >
        {children}
        {onClearAll ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs"
          >
            {messages.filters.clearAll}
          </Button>
        ) : null}
      </div>
    </AppliedFiltersBarContext.Provider>
  );
}

export interface AppliedFilterChipProps {
  label: string;
  value?: string;
  onRemove: () => void;
  className?: string;
}

/** One applied filter; activating it removes the filter. */
export function AppliedFilterChip({
  label,
  value,
  onRemove,
  className,
}: AppliedFilterChipProps) {
  const { messages } = useUiLocale();
  const bar = React.useContext(AppliedFiltersBarContext);
  const filter = value ? `${label}: ${value}` : label;

  return (
    <button
      type="button"
      data-applied-filter=""
      aria-label={formatUiMessage(messages.filters.removeFilter, {
        label: filter,
      })}
      title={filter}
      onClick={(event) => {
        bar?.chipRemoved(event.currentTarget);
        onRemove();
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1 text-xs text-foreground hover:bg-accent",
        className,
      )}
    >
      <span className="max-w-[10rem] truncate">
        <span className="text-muted-foreground">{label}</span>
        {value ? <span className="text-muted-foreground">: </span> : null}
        {value ? <span className="text-foreground">{value}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <X className="size-3.5" />
      </span>
    </button>
  );
}
