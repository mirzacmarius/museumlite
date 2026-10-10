"use client";

import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { cn } from "@v1/ui/utils";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { useScopedI18n } from "@/locales/client";
import type { LoanItem } from "../types";
import { getNonReturnedItemIds, isLoanItemReturned } from "./loan-item-utils";

interface ReturnItemSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanItems: LoanItem[];
  selectedItemIds: Set<string>;
  setSelectedItemIds: (ids: Set<string>) => void;
  onProceed: () => void;
  /** Why the last attempt did not go through, shown in the dialog. */
  refusal: Refusal | null;
  renderEvidence: (item: LoanItem) => ReactNode;
}

export function ReturnItemSelectionDialog({
  open,
  onOpenChange,
  loanItems,
  selectedItemIds,
  setSelectedItemIds,
  onProceed,
  refusal,
  renderEvidence,
}: ReturnItemSelectionDialogProps) {
  const t = useScopedI18n("loans.actions");
  const evidenceT = useScopedI18n("conditionAssessments");
  const hasSomeReturned = loanItems.some((item) => isLoanItemReturned(item));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        // A dialog reopened to explain a refusal starts on the refusal.
        onOpenAutoFocus={(event) => {
          if (refusal) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("returnLoanItems")}</DialogTitle>
          <DialogDescription>{t("selectItemsToReturnDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ActionRefusal refusal={refusal} />
          <p className="text-sm text-muted-foreground">
            {evidenceT("receiptRequirement")}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t("selectItemsToReturn")}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedItemIds(new Set(getNonReturnedItemIds(loanItems)));
              }}
            >
              {t("selectAllItems")}
            </Button>
          </div>
          {hasSomeReturned && (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/30">
              <Info className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="flex-1 text-blue-800 dark:text-blue-200">
                <p className="mb-1 font-medium">{t("someItemsReturned")}</p>
                <p className="text-xs">{t("returnedItemsInfo")}</p>
              </div>
            </div>
          )}
          <ul className="divide-y rounded-lg border">
            {loanItems.map((item) => {
              const isReturned = isLoanItemReturned(item);
              const checkboxId = `return-item-${item._id}`;

              return (
                <li
                  key={item._id}
                  className={cn(
                    "space-y-3 p-3",
                    isReturned &&
                      "border-l-4 border-l-blue-500 bg-muted/40 opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={checkboxId}
                      className="mt-0.5"
                      checked={selectedItemIds.has(item._id) && !isReturned}
                      disabled={isReturned}
                      onCheckedChange={(checked) => {
                        if (isReturned) return;
                        const newSet = new Set(selectedItemIds);
                        if (checked) {
                          newSet.add(item._id);
                        } else {
                          newSet.delete(item._id);
                        }
                        setSelectedItemIds(newSet);
                      }}
                    />
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        "min-w-0 flex-1 text-sm",
                        isReturned ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "break-all font-mono text-xs font-medium",
                            isReturned && "line-through",
                          )}
                        >
                          {item.accessionNumber}
                        </span>
                        {isReturned && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            {t("returned")}
                          </span>
                        )}
                      </span>{" "}
                      <span className="block break-words text-foreground">
                        {item.title}
                      </span>
                      {isReturned && item.conditionIn && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t("conditionInLabel")}: {item.conditionIn}
                        </span>
                      )}
                    </label>
                  </div>
                  {selectedItemIds.has(item._id) && !isReturned
                    ? renderEvidence(item)
                    : null}
                </li>
              );
            })}
          </ul>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedItemIds(new Set());
            }}
          >
            {t("cancel")}
          </Button>
          <Button onClick={onProceed} className="bg-blue-600 hover:bg-blue-700">
            {t("continueAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
