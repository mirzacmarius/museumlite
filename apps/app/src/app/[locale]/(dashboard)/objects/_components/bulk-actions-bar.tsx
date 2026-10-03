"use client";

import { Button } from "@v1/ui/button";
import {
  Archive,
  Download,
  FolderPlus,
  MapPin,
  Printer,
  X,
} from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";

import { useI18n } from "@/locales/client";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveLocation: () => void;
  onAddToGroup: () => void;
  onExport: () => void;
  onPrintLabels: () => void;
  onDeaccession: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onMoveLocation,
  onAddToGroup,
  onExport,
  onPrintLabels,
  onDeaccession,
}: BulkActionsBarProps) {
  const tRoot = useI18n();
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 border-r border-border pr-3">
          <span className="text-sm font-medium">
            {selectedCount} {tRoot("loans.table.items")}
            {selectedCount !== 1 ? "s" : ""}{" "}
            {tRoot("loans.bulkActions.selected")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClearSelection}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="collections.update">
            <Button variant="outline" size="sm" onClick={onAddToGroup}>
              <FolderPlus className="mr-2 size-4" />
              {tRoot("objects.bulkActions.addToGroup")}
            </Button>
          </PermissionGate>

          <PermissionGate permission="locations.update">
            <Button variant="outline" size="sm" onClick={onMoveLocation}>
              <MapPin className="mr-2 size-4" />
              {tRoot("objects.bulkActions.moveLocation")}
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.read">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 size-4" />
              {tRoot("objects.bulkActions.export")}
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.read">
            <Button variant="outline" size="sm" onClick={onPrintLabels}>
              <Printer className="mr-2 size-4" />
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
              <Archive className="mr-2 size-4" />
              {tRoot("objects.bulkActions.deaccession")}
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
