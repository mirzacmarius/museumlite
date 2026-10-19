"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Clock, Search, X } from "lucide-react";
import * as React from "react";
import { useI18n } from "@/locales/client";
import { useOrganization } from "./organization-provider";

interface SearchAutocompleteProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchAutocomplete({
  value = "",
  onValueChange,
  placeholder,
  className,
  debounceMs = 300,
}: SearchAutocompleteProps) {
  const translate = useI18n();
  const [open, setOpen] = React.useState(false);
  const { currentOrganizationId } = useOrganization();
  const debouncedValue = useDebouncedValue(value, debounceMs);

  // Fetch suggestions based on debounced value
  const normalizedQuery = debouncedValue.trim();
  const hasQuery = normalizedQuery.length > 1;

  const suggestions = useQuery(
    api.search.searchSuggestions,
    currentOrganizationId && hasQuery
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          query: normalizedQuery,
          limit: 8,
        }
      : "skip",
  );

  // Fetch recent search history (shown when dropdown is open)
  const searchHistory = useQuery(
    api.searchHistory.list,
    currentOrganizationId && open
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          module: "objects",
          limit: 5,
        }
      : "skip",
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onValueChange?.(newValue);

    // Open popover when user starts typing or has history to show
    if (newValue.trim().length > 1) {
      setOpen(true);
    } else if (!newValue.trim() && searchHistory && searchHistory.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleInputFocus = () => {
    // Show recent searches when focusing on empty input
    if (!value.trim() && searchHistory && searchHistory.length > 0) {
      setOpen(true);
    }
  };

  const saveSearchHistory = useMutation(api.searchHistory.save);

  const handleSelectSuggestion = (suggestion: string) => {
    onValueChange?.(suggestion);
    setOpen(false);

    // Save to search history
    if (currentOrganizationId && suggestion.trim().length > 1) {
      saveSearchHistory({
        organizationId: currentOrganizationId as Id<"organizations">,
        query: suggestion.trim(),
        module: "objects",
      }).catch(() => {
        // Silently fail - search history is not critical
      });
    }
  };

  const handleClear = () => {
    onValueChange?.("");
    setOpen(false);
  };

  const hasSuggestions = hasQuery && suggestions && suggestions.length > 0;
  const hasHistory = searchHistory && searchHistory.length > 0;
  const showDropdown = open && (hasSuggestions || hasHistory);

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative w-full", className)}>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={
              placeholder ??
              translate("untranslatedComponents.labels.searchObjects")
            }
            className="pl-9 pr-9"
            aria-label={translate(
              "untranslatedComponents.labels.searchWithAutocomplete",
            )}
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? "search-suggestions" : undefined}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={translate(
                "untranslatedComponents.labels.clearSearch",
              )}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--anchor-width)] p-0"
        align="start"
        initialFocus={false}
        id="search-suggestions"
      >
        <div className="max-h-[300px] overflow-y-auto">
          {/* Recent Searches */}
          {hasHistory && !hasQuery && (
            <>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                {translate("untranslatedComponents.labels.recentSearches")}
              </div>
              {searchHistory?.map((history) => (
                <button
                  key={history._id}
                  type="button"
                  onClick={() => handleSelectSuggestion(history.query)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  )}
                  role="option"
                  aria-selected={value === history.query}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{history.query}</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Suggestions */}
          {hasSuggestions && (
            <>
              {hasHistory && !hasQuery && (
                <div className="mx-2 my-1 border-t border-border" />
              )}
              {hasQuery && (
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {translate("untranslatedComponents.labels.suggestions")}
                </div>
              )}
              {Array.from(new Set(suggestions ?? [])).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  )}
                  role="option"
                  aria-selected={value === suggestion}
                >
                  <div className="flex items-center gap-2">
                    <Search className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{suggestion}</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
