"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { useMutation, useQuery } from "convex/react";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import * as React from "react";
import { useI18n } from "@/locales/client";
import { MaterialsComboboxDeleteDialog } from "./materials-combobox-delete-dialog";
import { MaterialsComboboxListContent } from "./materials-combobox-list-content";

interface MaterialsComboboxProps {
  /** Lets a form focus the field, e.g. to show an error. */
  id?: string;
  /** The visible label's id, which names the field. */
  "aria-labelledby"?: string;
  organizationId?: string;
  collectionId?: string;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const EMPTY_MATERIAL_VALUES: string[] = [];

function formatMaterialName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function MaterialsCombobox({
  organizationId,
  collectionId,
  value = EMPTY_MATERIAL_VALUES,
  onValueChange,
  placeholder,
  disabled = false,
  id,
  "aria-labelledby": ariaLabelledBy,
}: MaterialsComboboxProps) {
  const translate = useI18n();
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
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

  const selectedValues = React.useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const materials = useQuery(
    api.materialOptions.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

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

  const createMaterial = useMutation(api.materialOptions.create);
  const removeMaterial = useMutation(api.materialOptions.remove);

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
      onValueChange?.(
        selectedValues.filter(
          (v) => v.toLowerCase() !== selectedValue.toLowerCase(),
        ),
      );
    } else {
      onValueChange?.([...selectedValues, selectedValue]);
    }
    setInputValue("");
  };

  const handleRemove = (materialToRemove: string) => {
    onValueChange?.(selectedValues.filter((v) => v !== materialToRemove));
  };

  const filteredMaterials = materialOptions.filter((material) =>
    material.label.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const canCreateMaterial =
    !!organizationId &&
    inputValue.trim().length > 0 &&
    filteredMaterials.length === 0;

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

      if (!selectedValues.includes(formattedName)) {
        onValueChange?.([...selectedValues, formattedName]);
      }

      setInputValue("");
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        if (!selectedValues.includes(formattedName)) {
          onValueChange?.([...selectedValues, formattedName]);
        }
        setInputValue("");
      }
    }
  };

  const confirmDeleteMaterial = async () => {
    if (!materialToDelete) return;

    try {
      await removeMaterial({
        materialId: materialToDelete.id as Id<"materialOptions">,
      });
      if (selectedValues.includes(materialToDelete.name)) {
        onValueChange?.(
          selectedValues.filter((v) => v !== materialToDelete.name),
        );
      }
      setMaterialToDelete(null);
    } catch {
      setMaterialToDelete(null);
    }
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div
            id={id}
            role="combobox"
            aria-labelledby={ariaLabelledBy}
            aria-expanded={open}
            aria-controls={listId}
            tabIndex={disabled ? -1 : 0}
            className="flex min-h-[2.25rem] w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            onClick={openAndFocusInput}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                e.preventDefault();
                openAndFocusInput();
              }
            }}
          >
            {selectedValues.map((material) => (
              <span
                key={material}
                className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-xs"
              >
                <span>{material}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(material);
                  }}
                  className="hover:text-destructive cursor-pointer"
                  aria-label={translate(
                    "untranslatedComponents.labels.removeNamedItem",
                    { name: material },
                  )}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}

            <input
              ref={inputRef}
              type="text"
              className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
              placeholder={
                selectedValues.length === 0
                  ? (placeholder ??
                    translate(
                      "untranslatedComponents.labels.selectOrAddMaterials",
                    ))
                  : translate("untranslatedComponents.labels.searchOrAdd")
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
                aria-label={translate(
                  "untranslatedComponents.labels.addNamedItem",
                  { name: formatMaterialName(inputValue) },
                )}
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
                {translate("untranslatedComponents.labels.add")}
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
            <MaterialsComboboxListContent
              listId={listId}
              inputValue={inputValue}
              organizationId={organizationId}
              filteredMaterials={filteredMaterials}
              selectedValues={selectedValues}
              formatMaterialName={formatMaterialName}
              onSelect={handleSelect}
              onDeleteMaterial={(id, name) => setMaterialToDelete({ id, name })}
            />
          </Command>
        </PopoverContent>
      </Popover>

      <MaterialsComboboxDeleteDialog
        materialToDelete={materialToDelete}
        materialUsage={materialUsage ?? undefined}
        onOpenChange={() => setMaterialToDelete(null)}
        onConfirm={confirmDeleteMaterial}
      />
    </div>
  );
}
