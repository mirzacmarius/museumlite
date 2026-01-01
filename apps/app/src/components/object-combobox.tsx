"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";

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
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Fetch collections for the organization
  const collections = useQuery(
    api.collections.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 1000, cursor: null },
        }
      : "skip",
  );

  // Convert collections to options format, excluding current collection
  const objectOptions = React.useMemo(() => {
    if (!collections) return [];
    return collections.page
      .filter((obj: { _id: Id<"collections"> }) => obj._id !== collectionId)
      .map(
        (obj: {
          _id: Id<"collections">;
          title: string;
          accessionNumber: string;
        }) => ({
          value: obj._id,
          label: obj.title,
          accessionNumber: obj.accessionNumber,
        }),
      );
  }, [collections, collectionId]);

  // Get selected object
  const selectedObject = React.useMemo(() => {
    if (!value) return null;
    return objectOptions.find((obj) => obj.value === value);
  }, [value, objectOptions]);

  const handleSelect = (selectedValue: string) => {
    if (value === selectedValue) {
      // Deselect
      onValueChange?.(undefined);
    } else {
      // Select
      onValueChange?.(selectedValue);
    }
    setInputValue("");
    setOpen(false);
  };

  // Filter options based on search
  const filteredObjects = objectOptions.filter(
    (obj: { label: string; accessionNumber: string }) =>
      obj.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      obj.accessionNumber.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedObject ? (
            <span className="truncate">
              {selectedObject.label} ({selectedObject.accessionNumber})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>No objects found.</CommandEmpty>
            <CommandGroup>
              {filteredObjects.map(
                (obj: {
                  value: string;
                  label: string;
                  accessionNumber: string;
                }) => (
                  <CommandItem
                    key={obj.value}
                    value={obj.value}
                    onSelect={() => handleSelect(obj.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === obj.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{obj.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {obj.accessionNumber}
                      </span>
                    </div>
                  </CommandItem>
                ),
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
