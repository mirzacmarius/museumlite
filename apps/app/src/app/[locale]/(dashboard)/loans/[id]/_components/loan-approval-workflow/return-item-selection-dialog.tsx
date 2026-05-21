"use client";

import { useScopedI18n } from "@/locales/client";
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
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import { Info } from "lucide-react";
import type { LoanItem } from "../types";
import { getNonReturnedItemIds, isLoanItemReturned } from "./loan-item-utils";

interface ReturnItemSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanItems: LoanItem[];
  selectedItemIds: Set<string>;
  setSelectedItemIds: (ids: Set<string>) => void;
  onProceed: () => void;
}

export function ReturnItemSelectionDialog({
  open,
  onOpenChange,
  loanItems,
  selectedItemIds,
  setSelectedItemIds,
  onProceed,
}: ReturnItemSelectionDialogProps) {
  const t = useScopedI18n("loans.actions");
  const hasSomeReturned = loanItems.some((item) => isLoanItemReturned(item));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("returnLoanItems")}</DialogTitle>
          <DialogDescription>{t("selectItemsToReturnDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">
                {t("selectItemsToReturn")}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectedItemIds(new Set(getNonReturnedItemIds(loanItems)));
                }}
              >
                {t("selectAllItems")}
              </Button>
            </div>
            {hasSomeReturned && (
              <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-sm">
                <Info className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">{t("someItemsReturned")}</p>
                  <p className="text-xs">{t("returnedItemsInfo")}</p>
                </div>
              </div>
            )}
            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
              {loanItems.map((item) => {
                const isReturned = isLoanItemReturned(item);

                return (
                  <div
                    key={item._id}
                    className={cn(
                      "flex items-center space-x-3 p-3",
                      isReturned
                        ? "opacity-50 bg-muted/40 border-l-4 border-l-blue-500"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      id={`item-${item._id}`}
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
                    <Label
                      htmlFor={`item-${item._id}`}
                      className={cn(
                        "flex-1",
                        isReturned ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            isReturned && "line-through",
                          )}
                        >
                          {item.accessionNumber}
                        </span>
                        {isReturned && (
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                            {t("returned")}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.title}
                      </div>
                      {isReturned && item.conditionIn && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("conditionInLabel")}: {item.conditionIn}
                        </div>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
            {selectedItemIds.size === 0 && (
              <p className="text-sm text-destructive">
                {t("selectAtLeastOne")}
              </p>
            )}
          </div>
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
          <Button
            onClick={onProceed}
            disabled={selectedItemIds.size === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {t("continueAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
