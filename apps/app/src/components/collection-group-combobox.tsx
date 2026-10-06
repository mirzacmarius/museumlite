"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronsUpDown, FolderOpen, X } from "lucide-react";
import * as React from "react";
import { useI18n } from "@/locales/client";

interface CollectionGroupComboboxProps {
  organizationId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CollectionGroupCombobox({
  organizationId,
  value,
  onValueChange,
  placeholder,
  disabled = false,
}: CollectionGroupComboboxProps) {
  const translate = useI18n();
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const listId = React.useId();

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );
  const createCollectionGroup = useMutation(api.collectionGroups.create);

  const selectedValues = React.useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const selectedGroups = React.useMemo(() => {
    if (!collectionGroups) return [];
    const groupsById = new Map<string, (typeof collectionGroups)[number]>(
      collectionGroups.map((group) => [group._id, group]),
    );
    return selectedValues.flatMap((selectedValue) => {
      const group = groupsById.get(selectedValue);
      return group === undefined ? [] : [group];
    });
  }, [collectionGroups, selectedValues]);

  const filteredGroups = React.useMemo(() => {
    const normalizedInput = inputValue.trim().toLowerCase();
    if (!collectionGroups) return [];
    if (!normalizedInput) return collectionGroups;
    return collectionGroups.filter((group) =>
      group.name.toLowerCase().includes(normalizedInput),
    );
  }, [collectionGroups, inputValue]);

  const handleSelect = (selectedValue: string) => {
    if (selectedValues.includes(selectedValue)) {
      onValueChange?.(
        selectedValues.filter((valueItem) => valueItem !== selectedValue),
      );
    } else {
      onValueChange?.([...selectedValues, selectedValue]);
    }
    setInputValue("");
  };

  const handleRemove = (selectedValue: string) => {
    onValueChange?.(
      selectedValues.filter((valueItem) => valueItem !== selectedValue),
    );
  };

  const formatGroupName = (name: string) => {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const handleCreateAndSelect = async (name: string) => {
    if (!organizationId || !name.trim()) {
      return;
    }

    const formattedName = formatGroupName(name);
    const existingGroup = collectionGroups?.find(
      (group) => group.name.toLowerCase() === formattedName.toLowerCase(),
    );

    if (existingGroup) {
      handleSelect(existingGroup._id);
      return;
    }

    const groupId = await createCollectionGroup({
      organizationId: organizationId as Id<"organizations">,
      name: formattedName,
    });

    onValueChange?.([...selectedValues, groupId]);
    setInputValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          tabIndex={disabled ? -1 : 0}
          className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !disabled) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {selectedGroups.map((group) => (
            <span
              key={group._id}
              className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
            >
              <FolderOpen className="size-3 text-muted-foreground" />
              <span>{group.name}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemove(group._id);
                }}
                className="cursor-pointer hover:text-destructive"
                aria-label={translate(
                  "untranslatedComponents.labels.removeNamedItem",
                  { name: group.name },
                )}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          <input
            type="text"
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={
              selectedValues.length === 0
                ? (placeholder ??
                  translate("untranslatedComponents.labels.selectCollection"))
                : translate("untranslatedComponents.labels.searchOrAdd")
            }
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                inputValue.trim() &&
                filteredGroups.length === 0
              ) {
                event.preventDefault();
                void handleCreateAndSelect(inputValue);
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            disabled={disabled}
          />

          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList id={listId} className="max-h-[300px]">
            <CommandEmpty>
              {inputValue ? (
                <div className="p-4 text-center text-sm">
                  <p className="mb-2 text-muted-foreground">
                    {translate(
                      "untranslatedComponents.labels.noMatchingCollectionsFound",
                    )}
                  </p>
                  {organizationId ? (
                    <p className="text-xs text-muted-foreground">
                      {translate("untranslatedComponents.labels.press")}{" "}
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-semibold text-xs">
                        Enter
                      </kbd>{" "}
                      {translate("untranslatedComponents.labels.toAdd")}{" "}
                      <span className="font-medium text-foreground">
                        "{formatGroupName(inputValue)}"
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {translate(
                    "untranslatedComponents.labels.typeToSearchCollections",
                  )}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup
              heading={translate("untranslatedComponents.labels.collections")}
            >
              {filteredGroups.map((group) => (
                <CommandItem
                  key={group._id}
                  value={group._id}
                  onSelect={() => handleSelect(group._id)}
                  className="px-2 py-1.5"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      selectedValues.includes(group._id)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-4 text-muted-foreground" />
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
