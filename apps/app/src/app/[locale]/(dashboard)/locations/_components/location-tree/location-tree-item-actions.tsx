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
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import type { LocationItem, SelectedLocationAction } from "./types";

interface LocationTreeItemActionsProps {
  itemData: LocationItem;
  onEdit: (location: SelectedLocationAction) => void;
  onAddChild: (location: SelectedLocationAction) => void;
  onMove: (location: SelectedLocationAction) => void;
  onDelete: (location: SelectedLocationAction) => void;
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
          <PermissionGate permission="locations.update">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(actionPayload);
              }}
            >
              <Edit className="mr-2 size-4" />
              {t("edit")}
            </DropdownMenuItem>
          </PermissionGate>

          <PermissionGate permission="locations.create">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(actionPayload);
              }}
            >
              <Plus className="mr-2 size-4" />
              {t("addChild")}
            </DropdownMenuItem>
          </PermissionGate>

          <PermissionGate permission="locations.update">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onMove(actionPayload);
              }}
            >
              <Move className="mr-2 size-4" />
              {t("move")}
            </DropdownMenuItem>
          </PermissionGate>

          <PermissionGate permission="locations.delete">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(actionPayload);
              }}
            >
              <Trash2 className="mr-2 size-4" />
              {t("delete")}
            </DropdownMenuItem>
          </PermissionGate>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
