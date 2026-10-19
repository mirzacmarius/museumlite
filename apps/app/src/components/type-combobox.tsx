"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { useMutation, useQuery } from "convex/react";
import { ChevronsUpDown, Plus } from "lucide-react";
import * as React from "react";
import { useI18n } from "@/locales/client";
import { TypeComboboxDeleteDialog } from "./type-combobox-delete-dialog";
import { TypeComboboxListContent } from "./type-combobox-list-content";
import {
  formatTypeName,
  TypeComboboxSelectedBadge,
} from "./type-combobox-selected-badge";

interface TypeComboboxProps {
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
  canDeleteTypes?: boolean;
}

const EMPTY_TYPE_VALUES: string[] = [];

export function TypeCombobox({
  organizationId,
  collectionId,
  value = EMPTY_TYPE_VALUES,
  onValueChange,
  placeholder,
  disabled = false,
  canDeleteTypes = true,
  id,
  "aria-labelledby": ariaLabelledBy,
}: TypeComboboxProps) {
  const translate = useI18n();
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
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

  const selectedValues = React.useMemo(() => {
    return Array.isArray(value) ? value : [];
  }, [value]);

  const types = useQuery(
    api.typeOptions.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

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

  const createType = useMutation(api.typeOptions.create);
  const removeType = useMutation(api.typeOptions.remove);

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

  const handleRemove = (typeToRemove: string) => {
    onValueChange?.(selectedValues.filter((v) => v !== typeToRemove));
  };

  const filteredTypes = typeOptions.filter((type) =>
    type.label.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const canCreateType =
    !!organizationId &&
    inputValue.trim().length > 0 &&
    filteredTypes.length === 0;

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

  const confirmDeleteType = async () => {
    if (!typeToDelete) return;

    try {
      await removeType({
        typeId: typeToDelete.id as Id<"typeOptions">,
      });
      if (selectedValues.includes(typeToDelete.name)) {
        onValueChange?.(selectedValues.filter((v) => v !== typeToDelete.name));
      }
      setTypeToDelete(null);
    } catch {
      setTypeToDelete(null);
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
            {selectedValues.map((type) => (
              <TypeComboboxSelectedBadge
                key={type}
                type={type}
                onRemove={handleRemove}
              />
            ))}

            <input
              ref={inputRef}
              type="text"
              className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
              placeholder={
                selectedValues.length === 0
                  ? (placeholder ??
                    translate("untranslatedComponents.labels.selectOrAddTypes"))
                  : translate("untranslatedComponents.labels.searchOrAdd")
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
                aria-label={translate(
                  "untranslatedComponents.labels.addNamedItem",
                  { name: formatTypeName(inputValue) },
                )}
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
                <Plus className="size-3.5" />
                {translate("untranslatedComponents.labels.add")}
              </Button>
            ) : null}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] p-0"
          align="start"
          initialFocus={false}
        >
          <Command shouldFilter={false}>
            <TypeComboboxListContent
              listId={listId}
              inputValue={inputValue}
              organizationId={organizationId}
              filteredTypes={filteredTypes}
              selectedValues={selectedValues}
              canDeleteTypes={canDeleteTypes}
              formatTypeName={formatTypeName}
              onSelect={handleSelect}
              onDeleteType={(id, name) => setTypeToDelete({ id, name })}
            />
          </Command>
        </PopoverContent>
      </Popover>

      <TypeComboboxDeleteDialog
        typeToDelete={typeToDelete}
        typeUsage={typeUsage ?? undefined}
        onOpenChange={() => setTypeToDelete(null)}
        onConfirm={confirmDeleteType}
      />
    </div>
  );
}
