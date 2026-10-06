"use client";

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
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { useDrainedCollectionList } from "@/hooks/use-drained-collection-list";
import { useI18n } from "@/locales/client";

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
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const [inputValue, setInputValue] = React.useState("");

  const { items: collections, isComplete } = useDrainedCollectionList(
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
        }
      : "skip",
    { pageSize: 1000 },
  );

  const objectOptions = React.useMemo(() => {
    return collections.flatMap((obj) =>
      obj._id === collectionId
        ? []
        : [
            {
              value: obj._id,
              label: obj.title,
              accessionNumber: obj.accessionNumber,
            },
          ],
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
          aria-controls={listId}
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
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandList id={listId}>
            <CommandEmpty>
              {isComplete
                ? translate("untranslatedComponents.labels.noObjectsFound")
                : translate("untranslatedComponents.labels.loadingCollections")}
            </CommandEmpty>
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
                        "mr-2 size-4",
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
