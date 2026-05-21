"use client";

import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@v1/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface LocationPathSegment {
  _id: string;
  name: string;
}

interface LocationLayoutHeaderProps {
  selectedLocationPath: LocationPathSegment[];
  selectedLocationId: string;
  onDelete: () => void;
  onAdd: () => void;
  onEdit: () => void;
}

export function LocationLayoutHeader({
  selectedLocationPath,
  selectedLocationId,
  onDelete,
  onAdd,
  onEdit,
}: LocationLayoutHeaderProps) {
  return (
    <header className="-mx-6 sticky top-0 z-20 mb-8 flex h-14 items-center justify-between border-b border-border/60 bg-card/95 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="shrink-0 text-muted-foreground">Locations</span>
        {selectedLocationPath.map((pathLocation) => (
          <div
            key={pathLocation._id}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="shrink-0 text-muted-foreground/50">/</span>
            <span
              className={
                pathLocation._id === selectedLocationId
                  ? "truncate font-medium text-foreground"
                  : "truncate text-muted-foreground"
              }
            >
              {pathLocation.name}
            </span>
          </div>
        ))}
      </div>

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
