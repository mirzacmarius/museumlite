"use client";

import { Button } from "@v1/ui/button";
import { Archive, FolderPlus, MapPin, Printer } from "lucide-react";
import type { RefObject } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { SelectionActionBar } from "@/components/selection-action-bar";
import { useI18n, useScopedI18n } from "@/locales/client";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveLocation: () => void;
  onAddToGroup: () => void;
  onPrintLabels: () => void;
  onDeaccession: () => void;
  /** The object list, which takes focus back when the bar closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onMoveLocation,
  onAddToGroup,
  onPrintLabels,
  onDeaccession,
  returnFocusRef,
}: BulkActionsBarProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("objects.bulkActions");

  return (
    <SelectionActionBar
      label={t("label")}
      count={selectedCount}
      countLabel={t("objectsSelected", {
        count: selectedCount,
        s: selectedCount === 1 ? "" : "s",
      })}
      clearLabel={t("clearSelection")}
      onClear={onClearSelection}
      returnFocusRef={returnFocusRef}
    >
      <PermissionGate permission="collections.update">
        <Button variant="outline" size="sm" onClick={onAddToGroup}>
          <FolderPlus className="mr-2 size-4" aria-hidden="true" />
          {t("addToGroup")}
        </Button>
      </PermissionGate>

      <PermissionGate permission="locations.update">
        <Button variant="outline" size="sm" onClick={onMoveLocation}>
          <MapPin className="mr-2 size-4" aria-hidden="true" />
          {t("moveLocation")}
        </Button>
      </PermissionGate>

      <PermissionGate permission="collections.read">
        <Button variant="outline" size="sm" onClick={onPrintLabels}>
          <Printer className="mr-2 size-4" aria-hidden="true" />
          {tRoot("untranslatedRecords.objects.detail.printLabels")}
        </Button>
      </PermissionGate>

      <PermissionGate permission="collections.approve_deaccession">
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={onDeaccession}
        >
          <Archive className="mr-2 size-4" aria-hidden="true" />
          {t("deaccession")}
        </Button>
      </PermissionGate>
    </SelectionActionBar>
  );
}
