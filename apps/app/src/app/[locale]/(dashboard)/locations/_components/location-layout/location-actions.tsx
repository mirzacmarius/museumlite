"use client";

import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { IconActionButton } from "@/components/icon-action-button";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

interface LocationActionsProps {
  onDelete: () => void;
  onAdd: () => void;
  onEdit: () => void;
  onView: () => void;
}

export function LocationActions({
  onDelete,
  onAdd,
  onEdit,
  onView,
}: LocationActionsProps) {
  const { hasPermission, isLoading } = usePermissions();
  const tForm = useScopedI18n("locations.form");
  const tCommon = useScopedI18n("common");

  if (isLoading) return null;

  const canManage = hasPermission("organization.manage_settings");
  const canView = hasPermission("locations.read");
  const canDelete = canManage && hasPermission("locations.delete");
  const canCreate = canManage && hasPermission("locations.create");
  const canUpdate = canManage && hasPermission("locations.update");

  if (!canView && !canDelete && !canCreate && !canUpdate) return null;

  return (
    <div className="ms-auto flex shrink-0 items-center justify-end gap-2">
      {canView ? (
        <IconActionButton label={tForm("viewLocation")} onClick={onView}>
          <Eye className="size-4" aria-hidden="true" />
        </IconActionButton>
      ) : null}
      {canDelete ? (
        <IconActionButton
          label={tCommon("delete")}
          className="hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </IconActionButton>
      ) : null}
      {canCreate ? (
        <IconActionButton label={tForm("addChildLocation")} onClick={onAdd}>
          <Plus className="size-4" aria-hidden="true" />
        </IconActionButton>
      ) : null}
      {canUpdate ? (
        <IconActionButton label={tCommon("edit")} onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
        </IconActionButton>
      ) : null}
    </div>
  );
}
