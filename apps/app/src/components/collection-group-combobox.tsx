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
import { Check, ChevronsUpDown, FolderOpen } from "lucide-react";
import * as React from "react";

interface CollectionGroupComboboxProps {
  organizationId?: string;
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CollectionGroupCombobox({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select collection...",
  disabled = false,
}: CollectionGroupComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const selectedGroup = React.useMemo(() => {
    if (!value || !collectionGroups) return null;
    return collectionGroups.find((g) => g._id === value);
  }, [value, collectionGroups]);

  const handleSelect = (selectedValue: string) => {
    if (value === selectedValue) {
      onValueChange?.(undefined);
    } else {
      onValueChange?.(selectedValue);
    }
    setOpen(false);
  };

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
          {selectedGroup ? (
            <span className="truncate flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              {selectedGroup.name}
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
            <CommandEmpty>No collections found.</CommandEmpty>
            <CommandGroup>
              {collectionGroups?.map((group) => (
                <CommandItem
                  key={group._id}
                  value={group._id}
                  onSelect={() => handleSelect(group._id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === group._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{group.name}</span>
                      {group.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {group.description}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
