"use client";

import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Edit, MoreHorizontal, Move, Plus, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import {
  MultiPermissionGate,
  PermissionGate,
} from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { LocationItem, SelectedLocationAction } from "./types";

interface LocationTreeItemActionsProps {
  itemData: LocationItem;
  onEdit: (location: SelectedLocationAction) => void;
  onAddChild: (location: SelectedLocationAction) => void;
  onMove: (location: SelectedLocationAction) => void;
  onDelete: (location: SelectedLocationAction) => void;
}

function stopAndCall(event: MouseEvent, action: () => void) {
  event.stopPropagation();
  action();
}

export function LocationTreeItemActions({
  itemData,
  onEdit,
  onAddChild,
  onMove,
  onDelete,
}: LocationTreeItemActionsProps) {
  const t = useScopedI18n("locations.tree");

  const actionPayload: SelectedLocationAction = {
    id: itemData._id,
    name: itemData.name,
    parentId: itemData.parentLocationId,
    type: itemData.type,
    address: itemData.address,
  };

  return (
    <MultiPermissionGate
      permissions={["locations.create", "locations.delete"]}
      mode="any"
    >
      <div className="ml-auto z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">{t("actions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <PermissionGate permission="locations.create">
              <DropdownMenuItem
                onClick={(e) => stopAndCall(e, () => onEdit(actionPayload))}
              >
                <Edit className="mr-2 size-4" />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => stopAndCall(e, () => onAddChild(actionPayload))}
              >
                <Plus className="mr-2 size-4" />
                {t("addChild")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => stopAndCall(e, () => onMove(actionPayload))}
              >
                <Move className="mr-2 size-4" />
                {t("move")}
              </DropdownMenuItem>
              <PermissionGate permission="locations.delete">
                <DropdownMenuSeparator />
              </PermissionGate>
            </PermissionGate>

            <PermissionGate permission="locations.delete">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => stopAndCall(e, () => onDelete(actionPayload))}
              >
                <Trash2 className="mr-2 size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </PermissionGate>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </MultiPermissionGate>
  );
}
