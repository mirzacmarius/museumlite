"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useScopedI18n } from "@/locales/client";
import type { useLoanItemsManager } from "./use-loan-items-manager";

type LoanItemsManagerState = ReturnType<typeof useLoanItemsManager>;

interface ReturnItemDialogProps {
  manager: LoanItemsManagerState;
}

export function ReturnItemDialog({ manager }: ReturnItemDialogProps) {
  const tActions = useScopedI18n("loans.actions");
  const t = useScopedI18n("loans.placeholders");
  const common = useScopedI18n("common");

  return (
    <Dialog
      open={manager.isReturnDialogOpen}
      onOpenChange={manager.setIsReturnDialogOpen}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tActions("returnLoanItem")}</DialogTitle>
          <DialogDescription>{tActions("returnLoanItem")}</DialogDescription>
        </DialogHeader>

        {manager.selectedItemToReturn && (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">
                {manager.selectedItemToReturn.accessionNumber}
              </span>
              <span className="mx-2">•</span>
              <span>{manager.selectedItemToReturn.title}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditionIn">
                {tActions("conditionInLabel")}
              </Label>
              <Input
                id="conditionIn"
                value={manager.conditionIn}
                onChange={(e) => manager.setConditionIn(e.target.value)}
                placeholder={t("conditionIn")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnNotes">{tActions("notesLabel")}</Label>
              <Input
                id="returnNotes"
                value={manager.returnNotes}
                onChange={(e) => manager.setReturnNotes(e.target.value)}
                placeholder={t("returnNotes")}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => manager.setIsReturnDialogOpen(false)}
          >
            {common("cancel")}
          </Button>
          <Button onClick={manager.handleReturnItemConfirm}>
            {tActions("confirmReturn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
