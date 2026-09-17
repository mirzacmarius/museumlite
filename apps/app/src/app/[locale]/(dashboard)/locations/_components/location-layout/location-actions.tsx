"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@/components/icon-action-button";
import { PermissionGate } from "@/components/permission-gate";

interface LocationActionsProps {
  onDelete: () => void;
  onAdd: () => void;
  onEdit: () => void;
}

export function LocationActions({
  onDelete,
  onAdd,
  onEdit,
}: LocationActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <PermissionGate permission="locations.delete">
        <IconActionButton
          label="Delete"
          className="hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </IconActionButton>
      </PermissionGate>
      <PermissionGate permission="locations.create">
        <IconActionButton label="Add" onClick={onAdd}>
          <Plus className="size-4" aria-hidden="true" />
        </IconActionButton>
        <IconActionButton label="Edit" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
        </IconActionButton>
      </PermissionGate>
    </div>
  );
}
