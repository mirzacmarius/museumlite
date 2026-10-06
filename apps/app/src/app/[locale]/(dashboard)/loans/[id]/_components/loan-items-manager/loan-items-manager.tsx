"use client";

import { useI18n } from "@/locales/client";
import { AddItemsDialog } from "./add-items-dialog";
import { LoanItemsList } from "./loan-items-list";
import { ReturnItemDialog } from "./return-item-dialog";
import type { LoanItemsManagerProps } from "./types";
import { useLoanItemsManager } from "./use-loan-items-manager";

export function LoanItemsManager({
  loanId,
  loanItems,
  organizationId,
  loanStatus,
}: LoanItemsManagerProps) {
  const tRoot = useI18n();
  const manager = useLoanItemsManager({
    loanId,
    loanItems,
    organizationId,
    loanStatus,
  });

  return (
    <div className="space-y-4">
      {manager.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {manager.error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {tRoot("loans.actions.loanItems", {
            count: loanItems.length,
          })}
        </h3>
        <AddItemsDialog manager={manager} />
      </div>

      <LoanItemsList loanItems={loanItems} manager={manager} />
      <ReturnItemDialog manager={manager} />
    </div>
  );
}
