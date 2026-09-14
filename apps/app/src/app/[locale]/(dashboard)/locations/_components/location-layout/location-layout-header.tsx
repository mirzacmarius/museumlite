"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import {
  getExhibitionDropdownLabel,
  getExhibitionRootIds,
  type ExhibitionSpaceOption,
} from "../../location-view-helpers";
import { ExhibitionSpacesDropdown } from "./exhibition-spaces-dropdown";

interface LocationPathSegment {
  _id: Id<"locations">;
  name: string;
}

interface LocationLayoutHeaderProps {
  selectedLocationPath: LocationPathSegment[];
  selectedLocationId: Id<"locations">;
  exhibitionSpaceOptions: ExhibitionSpaceOption[];
  onSelectLocation: (id: Id<"locations">) => void;
  onDelete: () => void;
  onAdd: () => void;
  onEdit: () => void;
}

export function LocationLayoutHeader({
  selectedLocationPath,
  selectedLocationId,
  exhibitionSpaceOptions,
  onSelectLocation,
  onDelete,
  onAdd,
  onEdit,
}: LocationLayoutHeaderProps) {
  const exhibitionRootIds = getExhibitionRootIds(exhibitionSpaceOptions);
  const exhibitionRootIndex = selectedLocationPath.findIndex((pathLocation) =>
    exhibitionRootIds.has(pathLocation._id),
  );
  const remainingPathLocations =
    exhibitionRootIndex >= 0
      ? selectedLocationPath.slice(exhibitionRootIndex + 1)
      : selectedLocationPath;
  const dropdownLabel = getExhibitionDropdownLabel({
    selectedLocationId,
    selectedLocationPath,
    exhibitionSpaceOptions,
  });

  return (
    <header className="-mx-6 sticky top-0 z-20 mb-8 flex h-14 items-center justify-between border-b border-border/60 bg-card/95 px-6 backdrop-blur-xl">
      <nav
        aria-label="Location breadcrumbs"
        className="flex min-w-0 items-center gap-2 text-xs"
      >
        <span className="shrink-0 text-muted-foreground">Locations</span>
        {exhibitionSpaceOptions.length > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-muted-foreground/50">/</span>
            <ExhibitionSpacesDropdown
              exhibitionSpaceOptions={exhibitionSpaceOptions}
              selectedLocationId={selectedLocationId}
              triggerLabel={dropdownLabel}
              onSelectLocation={onSelectLocation}
            />
          </div>
        ) : null}
        {remainingPathLocations.map((pathLocation) => (
          <div
            key={pathLocation._id}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="shrink-0 text-muted-foreground/50">/</span>
            {pathLocation._id === selectedLocationId ? (
              <span className="truncate font-medium text-foreground">
                {pathLocation.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectLocation(pathLocation._id)}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {pathLocation.name}
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <PermissionGate permission="locations.delete">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </PermissionGate>
        <div className="h-4 w-px bg-border" />
        <PermissionGate permission="locations.create">
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="mr-2 size-3.5" />
            Add Location
          </Button>
        </PermissionGate>
        <PermissionGate permission="locations.update">
          <Button size="sm" onClick={onEdit}>
            <Pencil className="mr-2 size-3.5" />
            Edit Location
          </Button>
        </PermissionGate>
      </div>
    </header>
  );
}
