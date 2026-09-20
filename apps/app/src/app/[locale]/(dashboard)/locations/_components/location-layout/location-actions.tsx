"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@/components/icon-action-button";
import { usePermissions } from "@/components/permission-gate";

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
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!hasPermission("organization.manage_settings")) return null;

  const canDelete = hasPermission("locations.delete");
  const canCreate = hasPermission("locations.create");
  const canUpdate = hasPermission("locations.update");

  if (!canDelete && !canCreate && !canUpdate) return null;

  return (
    <div className="min-w-0 sm:justify-self-end">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Actions
      </dt>
      <dd className="mt-1.5 flex min-h-[1.75rem] items-end justify-start gap-2 sm:justify-end">
        {canDelete ? (
          <IconActionButton
            label="Delete"
            className="hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </IconActionButton>
        ) : null}
        {canCreate ? (
          <IconActionButton label="Add" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" />
          </IconActionButton>
        ) : null}
        {canUpdate ? (
          <IconActionButton label="Edit" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
          </IconActionButton>
        ) : null}
      </dd>
    </div>
  );
}
