"use client";

import {
  type CollectionType,
  getAvailableCollectionTypeOptions,
  isCollectionType,
  type ModuleId,
} from "@v1/backend/convex/utils/moduleCatalog";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@v1/ui/select";
import { Archive, Car, Coins, Gem, Leaf, Package, Wine } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export type { CollectionType };

interface CollectionTypeSelectorProps {
  value?: CollectionType;
  onValueChange: (value: CollectionType) => void;
  enabledModules?: ReadonlyArray<ModuleId>;
  disabled?: boolean;
}

const collectionTypeIcons: Record<CollectionType, ReactNode> = {
  general: <Package className="size-4" />,
  fine_art: <Gem className="size-4" />,
  wine: <Wine className="size-4" />,
  automotive: <Car className="size-4" />,
  natural_history: <Leaf className="size-4" />,
  archive: <Archive className="size-4" />,
  coins_stamps: <Coins className="size-4" />,
};

function getCollectionTypes(enabledModules: ReadonlyArray<ModuleId>) {
  return getAvailableCollectionTypeOptions(enabledModules).map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    icon: collectionTypeIcons[option.value],
  }));
}

const allCollectionTypes: Array<{
  value: CollectionType;
  label: string;
  description: string;
  icon: ReactNode;
}> = getCollectionTypes([
  "fine_art",
  "wine",
  "automotive",
  "natural_history",
  "archive",
  "coins_stamps",
]);

export function CollectionTypeSelector({
  value,
  onValueChange,
  enabledModules = [],
  disabled,
}: CollectionTypeSelectorProps) {
  const collectionTypes = getCollectionTypes(enabledModules);
  const selectedType: CollectionType =
    value && collectionTypes.some((type) => type.value === value)
      ? value
      : "general";

  useEffect(() => {
    if ((value ?? "general") !== selectedType) {
      onValueChange(selectedType);
    }
  }, [onValueChange, selectedType, value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="collectionType">Collection Type</Label>
      <Select
        value={selectedType}
        onValueChange={(val) => {
          if (isCollectionType(val)) {
            onValueChange(val);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger id="collectionType" className="w-full">
          <span className="truncate">
            {getCollectionTypeLabel(selectedType)}
          </span>
        </SelectTrigger>
        <SelectContent>
          {collectionTypes.map((type) => (
            <SelectItem
              key={type.value}
              value={type.value}
              textValue={type.label}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{type.icon}</span>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {type.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Determines which specialized fields are available for this item
      </p>
    </div>
  );
}

export function getCollectionTypeLabel(type?: CollectionType): string {
  return allCollectionTypes.find((t) => t.value === type)?.label ?? "General";
}

export function getCollectionTypeIcon(type?: CollectionType): ReactNode {
  return (
    allCollectionTypes.find((t) => t.value === type)?.icon ?? (
      <Package className="size-4" />
    )
  );
}
