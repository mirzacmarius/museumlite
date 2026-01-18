"use client";

import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { CheckCircle, Download, X, XCircle } from "lucide-react";

interface LoansBulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkApprove: () => void;
  onBulkCancel: () => void;
  onExport: () => void;
}

export function LoansBulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkApprove,
  onBulkCancel,
  onExport,
}: LoansBulkActionsBarProps) {
  const t = useScopedI18n("loans.bulkActions");
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
        <div className="flex items-center gap-2 border-r border-border pr-3">
          <span className="text-sm font-medium">
            {selectedCount} {selectedCount !== 1 ? t("loansPlural") : t("loan")}{" "}
            {t("selected")}
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
          <PermissionGate permission="loans.approve">
            <Button variant="outline" size="sm" onClick={onBulkApprove}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {t("approveSelected")}
            </Button>
          </PermissionGate>

          <PermissionGate permission="loans.read">
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />
              {t("export")}
            </Button>
          </PermissionGate>

          <PermissionGate permission="loans.update">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onBulkCancel}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t("cancelSelected")}
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
