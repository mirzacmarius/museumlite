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
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { ExternalLink, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { ManagedLoanItem } from "./types";
import type { useLoanItemsManager } from "./use-loan-items-manager";

type LoanItemsManagerState = ReturnType<typeof useLoanItemsManager>;

interface LoanItemsListProps {
  loanItems: ManagedLoanItem[];
  manager: LoanItemsManagerState;
}

export function LoanItemsList({ loanItems, manager }: LoanItemsListProps) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");
  const common = useScopedI18n("common");

  if (loanItems.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">
          {tRoot("loans.actions.noItemsInLoan")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loanItems.map((item) => (
        <div
          key={item._id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/objects/${item.collectionId}`}
                className="font-medium hover:underline"
              >
                {item.accessionNumber}
              </Link>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{item.title}</span>
            </div>
            {item.conditionOut && (
              <p className="mt-1 text-sm text-muted-foreground">
                {tRoot("untranslatedRecords.loans.items.conditionOut")}{" "}
                {item.conditionOut}
              </p>
            )}
            {item.conditionIn && (
              <p className="mt-1 text-sm text-muted-foreground">
                {tRoot("untranslatedRecords.loans.items.conditionIn")}{" "}
                {item.conditionIn}
              </p>
            )}
            {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
          </div>
          <div className="flex items-center gap-2">
            {manager.canReturnItems && !item.conditionIn && (
              <PermissionGate permission="loans.update">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => manager.handleReturnItemClick(item)}
                >
                  <RotateCcw className="mr-2 size-4" />
                  {tRoot("loans.actions.returnItem")}
                </Button>
              </PermissionGate>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/objects/${item.collectionId}`}>
                <ExternalLink className="size-4" />
              </Link>
            </Button>
            {manager.canRemoveItems && (
              <PermissionGate permission="loans.update">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tRoot("loans.actions.removeLoanItem")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tActions("removeItemConfirm")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => manager.handleRemoveItem(item._id)}
                      >
                        {tActions("removeItem")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGate>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
