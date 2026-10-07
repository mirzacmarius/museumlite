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

interface ConditionComboboxDeleteDialogProps {
  conditionToDelete: { id: string; name: string } | null;
  conditionUsage: OptionUsage | undefined;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ConditionComboboxDeleteDialog({
  conditionToDelete,
  conditionUsage,
  onOpenChange,
  onConfirm,
}: ConditionComboboxDeleteDialogProps) {
  const translate = useI18n();
  return (
    <AlertDialog
      open={!!conditionToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {conditionUsage?.isUsed
              ? translate("untranslatedComponents.labels.cannotDeleteCondition")
              : translate("untranslatedComponents.labels.deleteCondition")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {conditionUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  {translate("untranslatedComponents.labels.theCondition")}{" "}
                  <span className="font-semibold text-foreground">
                    "{conditionToDelete?.name}"
                  </span>{" "}
                  {translate(
                    "untranslatedComponents.labels.cannotBeDeletedBecauseItIsCurrentlyBeingUsedBy",
                  )}{" "}
                  {conditionUsage.usageCount}{" "}
                  {conditionUsage.usageCount === 1
                    ? translate("untranslatedComponents.labels.collection")
                    : translate("untranslatedComponents.labels.collections")}
                  .
                </div>
                {conditionUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">
                      {translate("untranslatedComponents.labels.usedIn")}
                    </div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {conditionUsage.collectionNames
                        .slice(0, 5)
                        .map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      {conditionUsage.collectionNames.length > 5 && (
                        <li className="italic">
                          {translate("untranslatedComponents.labels.and")}{" "}
                          {conditionUsage.collectionNames.length - 5}{" "}
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
                  "{conditionToDelete?.name}"
                </span>
                {translate(
                  "untranslatedComponents.labels.thisActionCannotBeUndone",
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {conditionUsage?.isUsed ? (
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
