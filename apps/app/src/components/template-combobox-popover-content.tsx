"use client";

import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@v1/ui/command";
import { cn } from "@v1/ui/utils";
import { Check, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { TemplateOption } from "./template-combobox-types";

interface TemplateComboboxPopoverContentProps {
  listId: string;
  inputValue: string;
  value?: string;
  filteredSystemPresets: TemplateOption[];
  filteredCustomTemplates: TemplateOption[];
  onInputChange: (value: string) => void;
  onSelect: (value: string) => void;
  onUseCustomFormat: (format: string) => void;
  onEditTemplate?: (id: string) => void;
  onDeleteTemplate?: (id: string) => void;
}

export function TemplateComboboxPopoverContent({
  listId,
  inputValue,
  value,
  filteredSystemPresets,
  filteredCustomTemplates,
  onInputChange,
  onSelect,
  onUseCustomFormat,
  onEditTemplate,
  onDeleteTemplate,
}: TemplateComboboxPopoverContentProps) {
  return (
    <>
      <CommandInput
        placeholder="Search templates or type custom format (must include counter like {####})..."
        value={inputValue}
        onValueChange={onInputChange}
      />
      <CommandList id={listId} className="max-h-[400px]">
        <CommandEmpty>
          {inputValue ? (
            <div className="p-4 text-sm">
              <p className="text-muted-foreground mb-3">
                No matching templates found.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full justify-start"
                onClick={() => onUseCustomFormat(inputValue)}
              >
                Use custom format:{" "}
                <code className="ml-2 font-mono text-xs">{inputValue}</code>
              </Button>
            </div>
          ) : (
            <span className="p-4 text-sm">
              Type to search or enter custom format
            </span>
          )}
        </CommandEmpty>

        {filteredSystemPresets.length > 0 && (
          <CommandGroup heading="System Templates (Pre-validated)">
            {filteredSystemPresets.map((preset) => (
              <CommandItem
                key={preset.value}
                value={preset.value}
                onSelect={() => onSelect(preset.value)}
                className="px-3 py-2"
              >
                <div className="flex w-full items-center gap-3">
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === preset.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {preset.label}
                        </span>
                        <Sparkles
                          className="size-3 text-blue-500 shrink-0"
                          aria-label="System template - guaranteed valid"
                        />
                      </div>
                      {preset.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {preset.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] shrink-0 px-2 py-0.5 h-5"
                    >
                      {preset.value}
                    </Badge>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredSystemPresets.length > 0 &&
          filteredCustomTemplates.length > 0 && <CommandSeparator />}

        {filteredCustomTemplates.length > 0 && (
          <CommandGroup heading="My Custom Templates">
            {filteredCustomTemplates.map((template) => (
              <CommandItem
                key={template.value}
                value={template.value}
                onSelect={() => onSelect(template.value)}
                className="px-3 py-2"
              >
                <div className="flex w-full items-center gap-3">
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === template.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div
                    role="group"
                    className="flex min-w-0 flex-1 items-center justify-between gap-2"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) {
                        e.stopPropagation();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        (e.target as HTMLElement).closest("button")
                      ) {
                        e.stopPropagation();
                      }
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">
                        {template.label}
                      </span>
                      {template.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] px-2 py-0.5 h-5"
                      >
                        {template.value}
                      </Badge>
                      {onEditTemplate && template.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-6 p-0"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onEditTemplate(template.id!);
                          }}
                        >
                          <Pencil className="size-3" />
                        </Button>
                      )}
                      {onDeleteTemplate && template.id && (
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
                            onDeleteTemplate(template.id!);
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );
}
