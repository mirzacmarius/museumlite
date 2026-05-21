"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { useMutation, useQuery } from "convex/react";
import { ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { ConditionComboboxDeleteDialog } from "./condition-combobox-delete-dialog";
import { ConditionComboboxListContent } from "./condition-combobox-list-content";
import {
  type ConditionComboboxProps,
  STANDARD_CONDITIONS,
  formatConditionName,
} from "./condition-combobox-types";

export type { ConditionOption } from "./condition-combobox-types";
export { getConditionIcon } from "./condition-combobox-types";

export function ConditionCombobox({
  organizationId,
  value,
  onValueChange,
  placeholder = "Select condition...",
  disabled = false,
}: ConditionComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const [inputValue, setInputValue] = React.useState("");
  const [conditionToDelete, setConditionToDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const customConditions = useQuery(
    api.conditionOptions.list,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const conditionUsage = useQuery(
    api.conditionOptions.checkUsage,
    conditionToDelete
      ? { conditionId: conditionToDelete.id as Id<"conditionOptions"> }
      : "skip",
  );

  const createCondition = useMutation(api.conditionOptions.create);
  const removeCondition = useMutation(api.conditionOptions.remove);

  const customConditionOptions = React.useMemo(() => {
    return (customConditions || []).map((condition) => ({
      value: condition.name,
      label: condition.name,
      description: condition.description,
      id: condition._id,
    }));
  }, [customConditions]);

  const allOptions = [...STANDARD_CONDITIONS, ...customConditionOptions];
  const selectedOption = allOptions.find(
    (option) => option.value.toLowerCase() === value?.toLowerCase(),
  );

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue;
    onValueChange?.(newValue);
    setOpen(false);
    setInputValue("");
  };

  const filteredSystemConditions = STANDARD_CONDITIONS.filter(
    (condition) =>
      condition.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      condition.description.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const filteredCustomConditions = customConditionOptions.filter(
    (condition) =>
      condition.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      condition.description.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const handleCreateAndSelectCondition = async (conditionName: string) => {
    if (!organizationId || !conditionName.trim()) {
      return;
    }

    const formattedName = formatConditionName(conditionName);

    try {
      await createCondition({
        organizationId: organizationId as Id<"organizations">,
        name: formattedName,
        description: `Custom condition: ${formattedName}`,
      });

      onValueChange?.(formattedName);
      setInputValue("");
      setOpen(false);
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        onValueChange?.(formattedName);
        setInputValue("");
        setOpen(false);
      }
    }
  };

  const confirmDeleteCondition = async () => {
    if (!conditionToDelete) return;

    try {
      await removeCondition({
        conditionId: conditionToDelete.id as Id<"conditionOptions">,
      });
      if (value === conditionToDelete.name) {
        onValueChange?.("");
      }
      setConditionToDelete(null);
    } catch {
      setConditionToDelete(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className="w-full justify-between h-9"
            disabled={disabled}
          >
            <span className="truncate text-left flex-1 text-sm">
              {selectedOption?.label || value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command shouldFilter={false}>
            <ConditionComboboxListContent
              listId={listId}
              inputValue={inputValue}
              organizationId={organizationId}
              value={value}
              filteredSystemConditions={filteredSystemConditions}
              filteredCustomConditions={filteredCustomConditions}
              onInputChange={setInputValue}
              onSelect={handleSelect}
              onCreateCondition={handleCreateAndSelectCondition}
              onDeleteCondition={(id, name) =>
                setConditionToDelete({ id, name })
              }
            />
          </Command>
        </PopoverContent>
      </Popover>

      <ConditionComboboxDeleteDialog
        conditionToDelete={conditionToDelete}
        conditionUsage={conditionUsage ?? undefined}
        onOpenChange={() => setConditionToDelete(null)}
        onConfirm={confirmDeleteCondition}
      />
    </>
  );
}
