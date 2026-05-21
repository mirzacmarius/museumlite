"use client";

import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
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
import { Trash2 } from "lucide-react";

interface EditCollectionDeleteZoneProps {
  groupName: string;
  isDeleting: boolean;
  onDelete: () => void;
}

export function EditCollectionDeleteZone({
  groupName,
  isDeleting,
  onDelete,
}: EditCollectionDeleteZoneProps) {
  const t = useScopedI18n("collections");
  const common = useScopedI18n("common");

  return (
    <div className="mt-12 border-t border-border pt-8">
      <h3 className="text-lg font-medium text-destructive mb-4">
        {t("delete.dangerZone")}
      </h3>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t("delete.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("delete.description")}
            </p>
          </div>
          <PermissionGate permission="collections.delete">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                  <Trash2 className="mr-2 size-4" />
                  {common("delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("delete.dialogTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{groupName}"? Objects in
                    this collection will be unlinked but not deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting
                      ? t("delete.deleting")
                      : t("delete.deleteButton")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
