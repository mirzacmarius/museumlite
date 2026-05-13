"use client";

import {
  COLLECTION_TYPE_OPTIONS,
  type CollectionType,
  isCollectionType,
} from "@v1/backend/convex/utils/moduleCatalog";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@v1/ui/select";
import { Archive, Car, Coins, Gem, Leaf, Package, Wine } from "lucide-react";
import type { ReactNode } from "react";

export type { CollectionType };

interface CollectionTypeSelectorProps {
  value?: CollectionType;
  onValueChange: (value: CollectionType) => void;
  disabled?: boolean;
}

const collectionTypeIcons: Record<CollectionType, ReactNode> = {
  general: <Package className="h-4 w-4" />,
  fine_art: <Gem className="h-4 w-4" />,
  wine: <Wine className="h-4 w-4" />,
  automotive: <Car className="h-4 w-4" />,
  natural_history: <Leaf className="h-4 w-4" />,
  archive: <Archive className="h-4 w-4" />,
  coins_stamps: <Coins className="h-4 w-4" />,
};

const collectionTypes: Array<{
  value: CollectionType;
  label: string;
  description: string;
  icon: ReactNode;
}> = COLLECTION_TYPE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.description,
  icon: collectionTypeIcons[option.value],
}));

export function CollectionTypeSelector({
  value,
  onValueChange,
  disabled,
}: CollectionTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="collectionType">Collection Type</Label>
      <Select
        value={value || "general"}
        onValueChange={(val) => {
          if (isCollectionType(val)) {
            onValueChange(val);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger id="collectionType" className="w-full">
          <span className="truncate">
            {getCollectionTypeLabel(value || "general")}
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
  return collectionTypes.find((t) => t.value === type)?.label ?? "General";
}

export function getCollectionTypeIcon(type?: CollectionType): ReactNode {
  return (
    collectionTypes.find((t) => t.value === type)?.icon ?? (
      <Package className="h-4 w-4" />
    )
  );
}
