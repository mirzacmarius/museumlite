"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
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
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronsUpDown, Plus, Trash2, X } from "lucide-react";
import * as React from "react";

interface TypeComboboxProps {
  organizationId?: string;
  collectionId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TypeCombobox({
  organizationId,
  collectionId,
  value = [],
  onValueChange,
  placeholder = "Select or add types...",
  disabled = false,
}: TypeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [typeToDelete, setTypeToDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const openAndFocusInput = () => {
    if (disabled) return;
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Ensure value is always an array
  const selectedValues = React.useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  // Fetch types for the organization
  const types = useQuery(
    api.typeOptions.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  // Check type usage when attempting to delete (exclude current collection)
  const typeUsage = useQuery(
    api.typeOptions.checkUsage,
    typeToDelete
      ? {
          typeId: typeToDelete.id as Id<"typeOptions">,
          excludeCollectionId: collectionId
            ? (collectionId as Id<"collections">)
            : undefined,
        }
      : "skip",
  );

  // Mutations
  const createType = useMutation(api.typeOptions.create);
  const removeType = useMutation(api.typeOptions.remove);

  // Convert types to options format
  const typeOptions = React.useMemo(() => {
    return (types || []).map((type) => ({
      value: type.name,
      label: type.name,
      id: type._id,
    }));
  }, [types]);

  const handleSelect = (selectedValue: string) => {
    const isSelected = selectedValues.some(
      (v) => v.toLowerCase() === selectedValue.toLowerCase(),
    );

    if (isSelected) {
      // Remove from selection
      onValueChange?.(
        selectedValues.filter(
          (v) => v.toLowerCase() !== selectedValue.toLowerCase(),
        ),
      );
    } else {
      // Add to selection
      onValueChange?.([...selectedValues, selectedValue]);
    }
    setInputValue("");
  };

  const handleRemove = (typeToRemove: string) => {
    onValueChange?.(selectedValues.filter((v) => v !== typeToRemove));
  };

  // Filter options based on search
  const filteredTypes = typeOptions.filter((type) =>
    type.label.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const canCreateType =
    !!organizationId &&
    inputValue.trim().length > 0 &&
    filteredTypes.length === 0;

  // Format type name with first letter uppercase
  const formatTypeName = (name: string): string => {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  // Handle creating and selecting type
  const handleCreateAndSelectType = async (typeName: string) => {
    if (!organizationId || !typeName.trim()) {
      return;
    }

    const formattedName = formatTypeName(typeName);

    try {
      await createType({
        organizationId: organizationId as Id<"organizations">,
        name: formattedName,
      });

      // Add the newly created type to selection
      if (!selectedValues.includes(formattedName)) {
        onValueChange?.([...selectedValues, formattedName]);
      }

      // Clear input
      setInputValue("");
    } catch (err) {
      // If type already exists, just add it to selection
      if (err instanceof Error && err.message.includes("already exists")) {
        if (!selectedValues.includes(formattedName)) {
          onValueChange?.([...selectedValues, formattedName]);
        }
        setInputValue("");
      }
    }
  };

  // Handle deleting type from organization
  const handleDeleteType = (typeId: string, typeName: string) => {
    setTypeToDelete({ id: typeId, name: typeName });
  };

  const confirmDeleteType = async () => {
    if (!typeToDelete) return;

    try {
      await removeType({
        typeId: typeToDelete.id as Id<"typeOptions">,
      });
      // Remove from selection if it was selected
      if (selectedValues.includes(typeToDelete.name)) {
        onValueChange?.(selectedValues.filter((v) => v !== typeToDelete.name));
      }
      setTypeToDelete(null);
    } catch (err) {
      // Silently fail
      setTypeToDelete(null);
    }
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            className="flex flex-wrap items-center gap-1 w-full min-h-[2.25rem] rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-text"
            onClick={openAndFocusInput}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                e.preventDefault();
                openAndFocusInput();
              }
            }}
          >
            {/* Selected types as badges */}
            {selectedValues.map((type) => (
              <div
                key={type}
                className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                  }
                }}
              >
                <span>{type}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(type);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRemove(type);
                    }
                  }}
                  className="hover:text-destructive cursor-pointer"
                  aria-label={`Remove ${type}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </div>
            ))}

            {/* Inline input for searching/adding */}
            <input
              ref={inputRef}
              type="text"
              className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
              placeholder={
                selectedValues.length === 0 ? placeholder : "Search or add..."
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim() && canCreateType) {
                  e.preventDefault();
                  handleCreateAndSelectType(inputValue);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                openAndFocusInput();
              }}
              disabled={disabled}
            />

            {canCreateType ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 gap-1.5 border border-border px-2 text-xs font-medium shadow-sm"
                aria-label={`Add ${formatTypeName(inputValue)}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleCreateAndSelectType(inputValue);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-[300px]">
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
                      onSelect={() => handleSelect(type.value)}
                      className="px-2 py-1.5"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            selectedValues.some(
                              (v) =>
                                v.toLowerCase() === type.value.toLowerCase(),
                            )
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="flex-1 text-sm">{type.label}</span>
                        {type.id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleDeleteType(type.id!, type.label);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!typeToDelete}
        onOpenChange={(open) => !open && setTypeToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {typeUsage?.isUsed ? "Cannot Delete Type" : "Delete Type"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {typeUsage?.isUsed ? (
                <div className="space-y-2">
                  <div>
                    The type{" "}
                    <span className="font-semibold text-foreground">
                      "{typeToDelete?.name}"
                    </span>{" "}
                    cannot be deleted because it is currently being used by{" "}
                    {typeUsage.usageCount}{" "}
                    {typeUsage.usageCount === 1 ? "collection" : "collections"}.
                  </div>
                  {typeUsage.collectionNames.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium mb-1">Used in:</div>
                      <ul className="text-xs list-disc pl-4 space-y-0.5">
                        {typeUsage.collectionNames.slice(0, 5).map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                        {typeUsage.collectionNames.length > 5 && (
                          <li className="italic">
                            ...and {typeUsage.collectionNames.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-foreground">
                    "{typeToDelete?.name}"
                  </span>
                  ? This action cannot be undone.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {typeUsage?.isUsed ? (
              <AlertDialogCancel>Close</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteType}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
