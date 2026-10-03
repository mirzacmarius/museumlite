"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { useMutation } from "convex/react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

export function UtilitiesTab({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("settings.developer");
  const untranslated = useScopedI18n(
    "untranslatedDashboard.settings.developer",
  );
  const common = useScopedI18n("common");
  const [isDeletingLoans, setIsDeletingLoans] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    deletedLoans: number;
    deletedLoanItems: number;
    updatedCollections: number;
  } | null>(null);

  const deleteAllLoans = useMutation(api.loans.deleteAllLoans);

  const handleDeleteAllLoans = async () => {
    setIsDeletingLoans(true);
    setDeleteResult(null);
    try {
      const result = await deleteAllLoans({ organizationId });
      setDeleteResult(result);
    } catch {
      alert(untranslated("failedToDeleteLoans"));
    } finally {
      setIsDeletingLoans(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("utilities")}</h2>
        <p className="text-sm text-muted-foreground">{t("utilitiesDesc")}</p>
      </div>

      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-2">
            <Trash2 className="size-5 text-destructive" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-lg font-semibold">{t("deleteAllLoans")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("deleteLoansDesc")}
              </p>
            </div>

            {deleteResult && (
              <div className="rounded-md bg-muted p-4 space-y-1">
                <p className="text-sm font-medium">{t("operationCompleted")}</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>
                    {t("deletedLoans", {
                      count: deleteResult.deletedLoans,
                      plural: deleteResult.deletedLoans !== 1 ? "s" : "",
                    })}
                  </li>
                  <li>
                    {t("deletedLoanItems", {
                      count: deleteResult.deletedLoanItems,
                      plural: deleteResult.deletedLoanItems !== 1 ? "s" : "",
                    })}
                  </li>
                  <li>
                    {t("updatedCollections", {
                      count: deleteResult.updatedCollections,
                      plural: deleteResult.updatedCollections !== 1 ? "s" : "",
                    })}
                  </li>
                </ul>
              </div>
            )}

            <PermissionGate permission="loans.update">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeletingLoans}>
                    <Trash2 className="mr-2 size-4" />
                    {isDeletingLoans ? common("deleting") : t("deleteAllLoans")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-5 text-destructive" />
                      {t("deleteLoansDialog")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p className="font-medium">{t("willDelete")}</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{t("allLoans")}</li>
                        <li>{t("allLoanItems")}</li>
                        <li>{t("restoreActive")}</li>
                      </ul>
                      <p className="pt-2 font-semibold text-destructive">
                        {t("cannotUndo")}
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllLoans}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          </div>
        </div>
      </div>
    </div>
  );
}
