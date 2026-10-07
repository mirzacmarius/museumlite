"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { useObjectSearchSelection } from "@/hooks/use-object-search-selection";
import { useI18n, useScopedI18n } from "@/locales/client";

interface ObjectComboboxProps {
  organizationId?: string;
  collectionId?: string; // Current collection ID to exclude from list
  value?: string; // Collection ID of selected parent object
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ObjectCombobox({
  organizationId,
  collectionId,
  value,
  onValueChange,
  placeholder = "Select parent object...",
  disabled = false,
}: ObjectComboboxProps) {
  const translate = useI18n();
  const tPicker = useScopedI18n("objectPicker");
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const [inputValue, setInputValue] = React.useState("");

  const picker = useObjectSearchSelection({
    organizationId: organizationId
      ? (organizationId as Id<"organizations">)
      : undefined,
    query: inputValue,
    enabled: open,
  });
  // The selected object may not be among the current results.
  const selectedObject = useQuery(
    api.collections.get,
    value ? { collectionId: value as Id<"collections"> } : "skip",
  );
  const objectOptions = picker.items.filter((obj) => obj._id !== collectionId);

  const handleSelect = (selectedValue: string) => {
    onValueChange?.(value === selectedValue ? undefined : selectedValue);
    setInputValue("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedObject ? (
            <span className="truncate">
              {selectedObject.title} ({selectedObject.accessionNumber})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={inputValue}
            onValueChange={setInputValue}
            placeholder={translate(
              "untranslatedComponents.labels.searchByAccessionNumberOrTitle",
            )}
          />
          <CommandList id={listId}>
            <CommandEmpty>
              {picker.isLoading
                ? translate("untranslatedComponents.labels.loadingCollections")
                : translate("untranslatedComponents.labels.noObjectsFound")}
            </CommandEmpty>
            <CommandGroup>
              {objectOptions.map((obj) => (
                <CommandItem
                  key={obj._id}
                  value={obj._id}
                  onSelect={() => handleSelect(obj._id)}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === obj._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{obj.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {obj.accessionNumber}
                    </span>
                  </div>
                </CommandItem>
              ))}
              {picker.canLoadMore ? (
                <CommandItem
                  value="load-more"
                  disabled={picker.isLoadingMore}
                  onSelect={picker.loadMore}
                >
                  {picker.isLoadingMore
                    ? tPicker("loading")
                    : tPicker("loadMore")}
                </CommandItem>
              ) : null}
            </CommandGroup>
            {picker.hasMoreMatches ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {tPicker("refineSearch")}
              </p>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
