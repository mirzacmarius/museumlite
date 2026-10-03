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

interface MaterialsComboboxDeleteDialogProps {
  materialToDelete: { id: string; name: string } | null;
  materialUsage: OptionUsage | undefined;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function MaterialsComboboxDeleteDialog({
  materialToDelete,
  materialUsage,
  onOpenChange,
  onConfirm,
}: MaterialsComboboxDeleteDialogProps) {
  const translate = useI18n();
  return (
    <AlertDialog
      open={!!materialToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {materialUsage?.isUsed
              ? translate("untranslatedComponents.labels.cannotDeleteMaterial")
              : translate("untranslatedComponents.labels.deleteMaterial")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {materialUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  {translate("untranslatedComponents.labels.theMaterial")}{" "}
                  <span className="font-semibold text-foreground">
                    "{materialToDelete?.name}"
                  </span>{" "}
                  {translate(
                    "untranslatedComponents.labels.cannotBeDeletedBecauseItIsCurrentlyBeingUsedBy",
                  )}{" "}
                  {materialUsage.usageCount}{" "}
                  {materialUsage.usageCount === 1
                    ? translate("untranslatedComponents.labels.collection")
                    : translate("untranslatedComponents.labels.collections")}
                  .
                </div>
                {materialUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">
                      {translate("untranslatedComponents.labels.usedIn")}
                    </div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {materialUsage.collectionNames.slice(0, 5).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                      {materialUsage.collectionNames.length > 5 && (
                        <li className="italic">
                          {translate("untranslatedComponents.labels.and")}{" "}
                          {materialUsage.collectionNames.length - 5}{" "}
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
                  "{materialToDelete?.name}"
                </span>
                {translate(
                  "untranslatedComponents.labels.thisActionCannotBeUndone",
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {materialUsage?.isUsed ? (
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
