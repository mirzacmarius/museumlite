"use client";

import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@v1/ui/button";
import {
  Archive,
  Download,
  FolderPlus,
  MapPin,
  Printer,
  X,
} from "lucide-react";

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
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 border-r border-border pr-3">
          <span className="text-sm font-medium">
            {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="collections.update">
            <Button variant="outline" size="sm" onClick={onAddToGroup}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Add to Group
            </Button>
          </PermissionGate>

          <PermissionGate permission="locations.update">
            <Button variant="outline" size="sm" onClick={onMoveLocation}>
              <MapPin className="mr-2 h-4 w-4" />
              Move Location
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.read">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.read">
            <Button variant="outline" size="sm" onClick={onPrintLabels}>
              <Printer className="mr-2 h-4 w-4" />
              Print Labels
            </Button>
          </PermissionGate>

          <PermissionGate permission="collections.approve_deaccession">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDeaccession}
            >
              <Archive className="mr-2 h-4 w-4" />
              Deaccession
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
