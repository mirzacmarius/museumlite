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
import { useI18n } from "@/locales/client";

interface OptionUsage {
  isUsed: boolean;
  usageCount: number;
  collectionNames: string[];
}

interface TypeComboboxDeleteDialogProps {
  typeToDelete: { id: string; name: string } | null;
  typeUsage: OptionUsage | undefined;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TypeComboboxDeleteDialog({
  typeToDelete,
  typeUsage,
  onOpenChange,
  onConfirm,
}: TypeComboboxDeleteDialogProps) {
  const translate = useI18n();
  return (
    <AlertDialog
      open={!!typeToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {typeUsage?.isUsed
              ? translate("untranslatedComponents.labels.cannotDeleteType")
              : translate("untranslatedComponents.labels.deleteType")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {typeUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  {translate("untranslatedComponents.labels.theType")}{" "}
                  <span className="font-semibold text-foreground">
                    "{typeToDelete?.name}"
                  </span>{" "}
                  {translate(
                    "untranslatedComponents.labels.cannotBeDeletedBecauseItIsCurrentlyBeingUsedBy",
                  )}{" "}
                  {typeUsage.usageCount}{" "}
                  {typeUsage.usageCount === 1
                    ? translate("untranslatedComponents.labels.collection")
                    : translate("untranslatedComponents.labels.collections")}
                  .
                </div>
                {typeUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">
                      {translate("untranslatedComponents.labels.usedIn")}
                    </div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {typeUsage.collectionNames.slice(0, 5).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                      {typeUsage.collectionNames.length > 5 && (
                        <li className="italic">
                          {translate("untranslatedComponents.labels.and")}{" "}
                          {typeUsage.collectionNames.length - 5}{" "}
                          {translate("untranslatedComponents.labels.more")}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {translate(
                  "untranslatedComponents.labels.areYouSureYouWantToDelete",
                )}{" "}
                <span className="font-semibold text-foreground">
                  "{typeToDelete?.name}"
                </span>
                {translate(
                  "untranslatedComponents.labels.thisActionCannotBeUndone",
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {typeUsage?.isUsed ? (
            <AlertDialogCancel>
              {translate("untranslatedComponents.labels.close")}
            </AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel>
                {translate("untranslatedComponents.labels.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {translate("untranslatedComponents.labels.delete")}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
