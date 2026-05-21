"use client";

import { Button } from "@v1/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { cn } from "@v1/ui/utils";
import { Check, Edit3, Trash2 } from "lucide-react";
import {
  type ConditionOption,
  STANDARD_CONDITIONS,
  formatConditionName,
} from "./condition-combobox-types";

interface ConditionComboboxListContentProps {
  listId: string;
  inputValue: string;
  organizationId?: string;
  value?: string;
  filteredSystemConditions: ConditionOption[];
  filteredCustomConditions: Array<{
    value: string;
    label: string;
    description: string;
    id?: string;
  }>;
  onInputChange: (value: string) => void;
  onSelect: (value: string) => void;
  onCreateCondition: (name: string) => void;
  onDeleteCondition: (id: string, name: string) => void;
}

export function ConditionComboboxListContent({
  listId,
  inputValue,
  organizationId,
  value,
  filteredSystemConditions,
  filteredCustomConditions,
  onInputChange,
  onSelect,
  onCreateCondition,
  onDeleteCondition,
}: ConditionComboboxListContentProps) {
  const hasResults =
    filteredSystemConditions.length > 0 || filteredCustomConditions.length > 0;

  return (
    <>
      <CommandInput
        placeholder="Search conditions or type new..."
        value={inputValue}
        onValueChange={onInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && inputValue.trim() && !hasResults) {
            e.preventDefault();
            onCreateCondition(inputValue);
          }
        }}
      />
      <CommandList id={listId} className="max-h-[300px]">
        <CommandEmpty>
          {inputValue ? (
            <div className="p-4 text-sm text-center">
              <div className="text-muted-foreground mb-2">
                No matching conditions found.
              </div>
              {organizationId && (
                <div className="text-xs text-muted-foreground">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold border rounded bg-muted">
                    Enter
                  </kbd>{" "}
                  to add{" "}
                  <span className="font-medium text-foreground">
                    "{formatConditionName(inputValue)}"
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Type to search conditions
            </div>
          )}
        </CommandEmpty>

        {(filteredSystemConditions.length > 0 ||
          filteredCustomConditions.length > 0) && (
          <CommandGroup>
            {filteredSystemConditions.map((condition) => (
              <ConditionListItem
                key={condition.value}
                condition={condition}
                value={value}
                onSelect={onSelect}
              />
            ))}
            {filteredCustomConditions.map((condition) => (
              <ConditionListItem
                key={condition.value}
                condition={{
                  ...condition,
                  icon: <Edit3 className="size-3.5 text-purple-500" />,
                }}
                value={value}
                onSelect={onSelect}
                onDelete={
                  condition.id
                    ? () => onDeleteCondition(condition.id!, condition.label)
                    : undefined
                }
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );
}

function ConditionListItem({
  condition,
  value,
  onSelect,
  onDelete,
}: {
  condition: ConditionOption;
  value?: string;
  onSelect: (value: string) => void;
  onDelete?: () => void;
}) {
  return (
    <CommandItem
      value={condition.value}
      onSelect={() => onSelect(condition.value)}
      className="px-2 py-1.5"
    >
      <div className="flex w-full items-start gap-2">
        <Check
          className={cn(
            "size-4 shrink-0 mt-0.5",
            value?.toLowerCase() === condition.value.toLowerCase()
              ? "opacity-100"
              : "opacity-0",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {condition.icon}
            <span className="font-medium text-sm">{condition.label}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {condition.description}
          </div>
        </div>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-destructive hover:text-destructive shrink-0"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>
    </CommandItem>
  );
}

export { STANDARD_CONDITIONS };
