"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { pluralize } from "@/lib/utils/pluralize";
import { useScopedI18n } from "@/locales/client";

interface ReturnConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFullReturn: boolean;
  loanItemCount: number;
  pendingReturnItemIds: string[];
  isSubmitting: boolean;
  onConfirm: () => void;
  onGoBack: () => void;
}

export function ReturnConfirmDialog({
  open,
  onOpenChange,
  isFullReturn,
  loanItemCount,
  pendingReturnItemIds,
  isSubmitting,
  onConfirm,
  onGoBack,
}: ReturnConfirmDialogProps) {
  const t = useScopedI18n("loans.actions");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isFullReturn ? t("confirmFullReturn") : t("confirmPartialReturn")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {isFullReturn ? (
                <>
                  <div className="font-medium">
                    {t("fullReturnTitle", {
                      count: loanItemCount,
                      items: pluralize(loanItemCount, "item"),
                    })}
                  </div>
                  <div>{t("fullReturnDescription")}</div>
                </>
              ) : (
                <>
                  <div className="font-medium">
                    {t("partialReturnTitle", {
                      returnCount: pendingReturnItemIds.length,
                      totalCount: loanItemCount,
                      items: pluralize(loanItemCount, "item"),
                    })}
                  </div>
                  <div>
                    {t("partialReturnDescription")}{" "}
                    {t("remainingItems", {
                      count: loanItemCount - pendingReturnItemIds.length,
                      items: pluralize(
                        loanItemCount - pendingReturnItemIds.length,
                        "item",
                      ),
                    })}
                  </div>
                </>
              )}
              <div className="pt-2 text-sm text-muted-foreground">
                {t("confirmProceed")}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onGoBack}>
            {t("goBack")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting
              ? t("returning")
              : isFullReturn
                ? t("returnAllItems")
                : t("confirmPartialReturn")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
