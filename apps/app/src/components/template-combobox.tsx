"use client";

import { Button } from "@v1/ui/button";
import { Command } from "@v1/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { TemplateComboboxFormatModifier } from "./template-combobox-format-modifier";
import { TemplateComboboxPopoverContent } from "./template-combobox-popover-content";
import type { TemplateComboboxProps } from "./template-combobox-types";

export type {
  TemplateOption,
  ValidationResult,
} from "./template-combobox-types";

export function TemplateCombobox({
  systemPresets,
  customTemplates,
  value,
  onValueChange,
  placeholder = "Select template...",
  disabled = false,
  validation,
  onSaveTemplate,
  onEditTemplate,
  onDeleteTemplate,
}: TemplateComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const [inputValue, setInputValue] = React.useState("");
  const [showQuickInsert, setShowQuickInsert] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value || "");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditValue(value || "");
  }, [value]);

  const allOptions = [...systemPresets, ...customTemplates];
  const selectedOption = allOptions.find((option) => option.value === value);

  const handleSelect = (selectedValue: string) => {
    const newValue = selectedValue === value ? "" : selectedValue;
    onValueChange?.(newValue);
    setEditValue(newValue);
    setInputValue("");
  };

  const insertToken = (token: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue =
      editValue.substring(0, start) + token + editValue.substring(end);

    setEditValue(newValue);
    onValueChange?.(newValue);

    setTimeout(() => {
      input.focus();
      const newPosition = start + token.length;
      input.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSave = async () => {
    if (onSaveTemplate && editValue && validation?.isValid) {
      await onSaveTemplate(editValue);
    }
  };

  const filteredSystemPresets = systemPresets.filter(
    (preset) =>
      preset.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      preset.value.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const filteredCustomTemplates = customTemplates.filter(
    (template) =>
      template.label.toLowerCase().includes(inputValue.toLowerCase()) ||
      template.value.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
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
      <PopoverContent className="w-[600px] p-0" align="start">
        <Command shouldFilter={false}>
          <TemplateComboboxPopoverContent
            listId={listId}
            inputValue={inputValue}
            value={value}
            filteredSystemPresets={filteredSystemPresets}
            filteredCustomTemplates={filteredCustomTemplates}
            onInputChange={setInputValue}
            onSelect={handleSelect}
            onUseCustomFormat={(format) => {
              onValueChange?.(format);
              setOpen(false);
              setInputValue("");
            }}
            onEditTemplate={onEditTemplate}
            onDeleteTemplate={onDeleteTemplate}
          />
          <TemplateComboboxFormatModifier
            editValue={editValue}
            inputRef={inputRef}
            showQuickInsert={showQuickInsert}
            setShowQuickInsert={setShowQuickInsert}
            validation={validation}
            onEditValueChange={(nextValue) => {
              setEditValue(nextValue);
              onValueChange?.(nextValue);
            }}
            onSave={onSaveTemplate ? handleSave : undefined}
            onInsertToken={insertToken}
          />
        </Command>
      </PopoverContent>
    </Popover>
  );
}
