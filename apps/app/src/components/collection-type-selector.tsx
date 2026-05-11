"use client";

import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Archive, Car, Coins, Gem, Leaf, Package, Wine } from "lucide-react";

export type CollectionType =
  | "fine_art"
  | "wine"
  | "automotive"
  | "natural_history"
  | "archive"
  | "coins_stamps"
  | "general";

interface CollectionTypeSelectorProps {
  value?: CollectionType;
  onValueChange: (value: CollectionType) => void;
  disabled?: boolean;
}

const collectionTypes: {
  value: CollectionType;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "general",
    label: "General",
    description: "Standard collection item",
    icon: <Package className="h-4 w-4" />,
  },
  {
    value: "fine_art",
    label: "Fine Art",
    description: "Paintings, sculptures, artworks",
    icon: <Gem className="h-4 w-4" />,
  },
  {
    value: "wine",
    label: "Wine & Spirits",
    description: "Wine cellar management",
    icon: <Wine className="h-4 w-4" />,
  },
  {
    value: "automotive",
    label: "Automotive",
    description: "Classic cars, motorcycles",
    icon: <Car className="h-4 w-4" />,
  },
  {
    value: "natural_history",
    label: "Natural History",
    description: "Specimens, fossils, minerals",
    icon: <Leaf className="h-4 w-4" />,
  },
  {
    value: "archive",
    label: "Corporate Archive",
    description: "Documents, records, DAM",
    icon: <Archive className="h-4 w-4" />,
  },
  {
    value: "coins_stamps",
    label: "Coins and Stamps",
    description: "Numismatic and philatelic records",
    icon: <Coins className="h-4 w-4" />,
  },
];

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
        onValueChange={(val) => onValueChange(val as CollectionType)}
        disabled={disabled}
      >
        <SelectTrigger id="collectionType" className="w-full">
          <SelectValue placeholder="Select collection type" />
        </SelectTrigger>
        <SelectContent>
          {collectionTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
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

export function getCollectionTypeIcon(type?: CollectionType): React.ReactNode {
  return (
    collectionTypes.find((t) => t.value === type)?.icon ?? (
      <Package className="h-4 w-4" />
    )
  );
}
