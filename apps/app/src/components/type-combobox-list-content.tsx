"use client";

import { Button } from "@v1/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { cn } from "@v1/ui/utils";
import { Check, Trash2 } from "lucide-react";

interface TypeOption {
  value: string;
  label: string;
  id?: string;
}

interface TypeComboboxListContentProps {
  listId: string;
  inputValue: string;
  organizationId?: string;
  filteredTypes: TypeOption[];
  selectedValues: string[];
  canDeleteTypes: boolean;
  formatTypeName: (name: string) => string;
  onSelect: (value: string) => void;
  onDeleteType: (id: string, name: string) => void;
}

export function TypeComboboxListContent({
  listId,
  inputValue,
  organizationId,
  filteredTypes,
  selectedValues,
  canDeleteTypes,
  formatTypeName,
  onSelect,
  onDeleteType,
}: TypeComboboxListContentProps) {
  return (
    <CommandList id={listId} className="max-h-[300px]">
      <CommandEmpty>
        {inputValue ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">
              No matching types found.
            </p>
            {organizationId && (
              <p className="text-xs text-muted-foreground">
                Press{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-semibold border rounded bg-muted">
                  Enter
                </kbd>{" "}
                to add{" "}
                <span className="font-medium text-foreground">
                  "{formatTypeName(inputValue)}"
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Type to search types
          </div>
        )}
      </CommandEmpty>

      {filteredTypes.length > 0 && (
        <CommandGroup heading="Organization Types">
          {filteredTypes.map((type) => (
            <CommandItem
              key={type.value}
              value={type.value}
              onSelect={() => onSelect(type.value)}
              className="px-2 py-1.5"
            >
              <div className="flex w-full items-center gap-2">
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    selectedValues.some(
                      (v) => v.toLowerCase() === type.value.toLowerCase(),
                    )
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                />
                <span className="flex-1 text-sm">{type.label}</span>
                {canDeleteTypes && type.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0 text-destructive hover:text-destructive"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onDeleteType(type.id!, type.label);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                ) : null}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );
}
