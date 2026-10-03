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
import { useI18n } from "@/locales/client";

interface MaterialOption {
  value: string;
  label: string;
  id?: string;
}

interface MaterialsComboboxListContentProps {
  listId: string;
  inputValue: string;
  organizationId?: string;
  filteredMaterials: MaterialOption[];
  selectedValues: string[];
  formatMaterialName: (name: string) => string;
  onSelect: (value: string) => void;
  onDeleteMaterial: (id: string, name: string) => void;
}

export function MaterialsComboboxListContent({
  listId,
  inputValue,
  organizationId,
  filteredMaterials,
  selectedValues,
  formatMaterialName,
  onSelect,
  onDeleteMaterial,
}: MaterialsComboboxListContentProps) {
  const translate = useI18n();
  return (
    <CommandList id={listId} className="max-h-[300px]">
      <CommandEmpty>
        {inputValue ? (
          <div className="p-4 text-sm text-center">
            <p className="text-muted-foreground mb-2">
              {translate(
                "untranslatedComponents.labels.noMatchingMaterialsFound",
              )}
            </p>
            {organizationId && (
              <p className="text-xs text-muted-foreground">
                {translate("untranslatedComponents.labels.press")}{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-semibold border rounded bg-muted">
                  Enter
                </kbd>{" "}
                {translate("untranslatedComponents.labels.toAdd")}{" "}
                <span className="font-medium text-foreground">
                  "{formatMaterialName(inputValue)}"
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground text-center">
            {translate("untranslatedComponents.labels.typeToSearchMaterials")}
          </div>
        )}
      </CommandEmpty>

      {filteredMaterials.length > 0 && (
        <CommandGroup
          heading={translate(
            "untranslatedComponents.labels.organizationMaterials",
          )}
        >
          {filteredMaterials.map((material) => (
            <CommandItem
              key={material.value}
              value={material.value}
              onSelect={() => onSelect(material.value)}
              className="px-2 py-1.5"
            >
              <div className="flex w-full items-center gap-2">
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    selectedValues.some(
                      (v) => v.toLowerCase() === material.value.toLowerCase(),
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
                      onDeleteMaterial(material.id!, material.label);
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
  );
}
