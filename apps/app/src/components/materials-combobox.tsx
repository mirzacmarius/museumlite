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

interface MaterialsComboboxProps {
  organizationId?: string;
  collectionId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MaterialsCombobox({
  organizationId,
  collectionId,
  value = [],
  onValueChange,
  placeholder = "Select or add materials...",
  disabled = false,
}: MaterialsComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [materialToDelete, setMaterialToDelete] = React.useState<{
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

  // Fetch materials for the organization
  const materials = useQuery(
    api.materialOptions.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  // Check material usage when attempting to delete (exclude current collection)
  const materialUsage = useQuery(
    api.materialOptions.checkUsage,
    materialToDelete
      ? {
          materialId: materialToDelete.id as Id<"materialOptions">,
          excludeCollectionId: collectionId
            ? (collectionId as Id<"collections">)
            : undefined,
        }
      : "skip",
  );

  // Mutations
  const createMaterial = useMutation(api.materialOptions.create);
  const removeMaterial = useMutation(api.materialOptions.remove);

  // Convert materials to options format
  const materialOptions = React.useMemo(() => {
    return (materials || []).map((material) => ({
      value: material.name,
      label: material.name,
      id: material._id,
    }));
  }, [materials]);

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

  const handleRemove = (materialToRemove: string) => {
    onValueChange?.(selectedValues.filter((v) => v !== materialToRemove));
  };

  // Filter options based on search
  const filteredMaterials = materialOptions.filter((material) =>
    material.label.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const canCreateMaterial =
    !!organizationId &&
    inputValue.trim().length > 0 &&
    filteredMaterials.length === 0;

  // Format material name with first letter uppercase
  const formatMaterialName = (name: string): string => {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  // Handle creating and selecting material
  const handleCreateAndSelectMaterial = async (materialName: string) => {
    if (!organizationId || !materialName.trim()) {
      return;
    }

    const formattedName = formatMaterialName(materialName);

    try {
      await createMaterial({
        organizationId: organizationId as Id<"organizations">,
        name: formattedName,
      });

      // Add the newly created material to selection
      if (!selectedValues.includes(formattedName)) {
        onValueChange?.([...selectedValues, formattedName]);
      }

      // Clear input
      setInputValue("");
    } catch (err) {
      // If material already exists, just add it to selection
      if (err instanceof Error && err.message.includes("already exists")) {
        if (!selectedValues.includes(formattedName)) {
          onValueChange?.([...selectedValues, formattedName]);
        }
        setInputValue("");
      }
    }
  };

  // Handle deleting material from organization
  const handleDeleteMaterial = (materialId: string, materialName: string) => {
    setMaterialToDelete({ id: materialId, name: materialName });
  };

  const confirmDeleteMaterial = async () => {
    if (!materialToDelete) return;

    try {
      await removeMaterial({
        materialId: materialToDelete.id as Id<"materialOptions">,
      });
      // Remove from selection if it was selected
      if (selectedValues.includes(materialToDelete.name)) {
        onValueChange?.(
          selectedValues.filter((v) => v !== materialToDelete.name),
        );
      }
      setMaterialToDelete(null);
    } catch (err) {
      // Silently fail
      setMaterialToDelete(null);
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
            {/* Selected materials as badges */}
            {selectedValues.map((material) => (
              <div
                key={material}
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
                <span>{material}</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(material);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      handleRemove(material);
                    }
                  }}
                  className="hover:text-destructive cursor-pointer"
                  aria-label={`Remove ${material}`}
                >
                  <X className="size-3" />
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
                if (
                  e.key === "Enter" &&
                  inputValue.trim() &&
                  canCreateMaterial
                ) {
                  e.preventDefault();
                  handleCreateAndSelectMaterial(inputValue);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                openAndFocusInput();
              }}
              disabled={disabled}
            />

            {canCreateMaterial ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 gap-1.5 border border-border px-2 text-xs font-medium shadow-sm"
                aria-label={`Add ${formatMaterialName(inputValue)}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleCreateAndSelectMaterial(inputValue);
                }}
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            ) : null}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
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
                      No matching materials found.
                    </p>
                    {organizationId && (
                      <p className="text-xs text-muted-foreground">
                        Press{" "}
                        <kbd className="px-1.5 py-0.5 text-xs font-semibold border rounded bg-muted">
                          Enter
                        </kbd>{" "}
                        to add{" "}
                        <span className="font-medium text-foreground">
                          "{formatMaterialName(inputValue)}"
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Type to search materials
                  </div>
                )}
              </CommandEmpty>

              {filteredMaterials.length > 0 && (
                <CommandGroup heading="Organization Materials">
                  {filteredMaterials.map((material) => (
                    <CommandItem
                      key={material.value}
                      value={material.value}
                      onSelect={() => handleSelect(material.value)}
                      className="px-2 py-1.5"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Check
                          className={cn(
                            "size-4 shrink-0",
                            selectedValues.some(
                              (v) =>
                                v.toLowerCase() ===
                                material.value.toLowerCase(),
                            )
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="flex-1 text-sm">{material.label}</span>
                        {material.id && (
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
                              handleDeleteMaterial(
                                material.id!,
                                material.label,
                              );
                            }}
                          >
                            <Trash2 className="size-3" />
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
        open={!!materialToDelete}
        onOpenChange={(open) => !open && setMaterialToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {materialUsage?.isUsed
                ? "Cannot Delete Material"
                : "Delete Material"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {materialUsage?.isUsed ? (
                <div className="space-y-2">
                  <div>
                    The material{" "}
                    <span className="font-semibold text-foreground">
                      "{materialToDelete?.name}"
                    </span>{" "}
                    cannot be deleted because it is currently being used by{" "}
                    {materialUsage.usageCount}{" "}
                    {materialUsage.usageCount === 1
                      ? "collection"
                      : "collections"}
                    .
                  </div>
                  {materialUsage.collectionNames.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium mb-1">Used in:</div>
                      <ul className="text-xs list-disc pl-4 space-y-0.5">
                        {materialUsage.collectionNames
                          .slice(0, 5)
                          .map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        {materialUsage.collectionNames.length > 5 && (
                          <li className="italic">
                            ...and {materialUsage.collectionNames.length - 5}{" "}
                            more
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
                    "{materialToDelete?.name}"
                  </span>
                  ? This action cannot be undone.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {materialUsage?.isUsed ? (
              <AlertDialogCancel>Close</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteMaterial}
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
