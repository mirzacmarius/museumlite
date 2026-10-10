"use client";

import { Button } from "@v1/ui/button";
import { CheckCircle, Download, XCircle } from "lucide-react";
import type { RefObject } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { SelectionActionBar } from "@/components/selection-action-bar";
import { useScopedI18n } from "@/locales/client";

interface LoansBulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkApprove: () => void;
  onBulkCancel: () => void;
  onExport: () => void;
  /** The loan list, which takes focus back when the bar closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function LoansBulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkApprove,
  onBulkCancel,
  onExport,
  returnFocusRef,
}: LoansBulkActionsBarProps) {
  const t = useScopedI18n("loans.bulkActions");

  return (
    <SelectionActionBar
      label={t("label")}
      count={selectedCount}
      countLabel={t("loansSelected", {
        count: selectedCount,
        s: selectedCount === 1 ? "" : "s",
      })}
      clearLabel={t("clearSelection")}
      onClear={onClearSelection}
      returnFocusRef={returnFocusRef}
    >
      <PermissionGate permission="loans.approve">
        <Button variant="outline" size="sm" onClick={onBulkApprove}>
          <CheckCircle className="mr-2 size-4" aria-hidden="true" />
          {t("approveSelected")}
        </Button>
      </PermissionGate>

      <PermissionGate permission="loans.read">
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 size-4" aria-hidden="true" />
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
          <XCircle className="mr-2 size-4" aria-hidden="true" />
          {t("cancelSelected")}
        </Button>
      </PermissionGate>
    </SelectionActionBar>
  );
}
