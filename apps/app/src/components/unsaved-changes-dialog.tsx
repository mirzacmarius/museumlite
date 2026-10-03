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

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSave?: () => Promise<boolean | undefined>;
  isSaving?: boolean;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onSave,
  isSaving = false,
}: UnsavedChangesDialogProps) {
  const translate = useI18n();
  const handleSave = async () => {
    if (onSave) {
      const shouldClose = await onSave();
      if (shouldClose === false) {
        return;
      }
    }
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {translate("untranslatedComponents.labels.unsavedChanges")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {translate(
              "untranslatedComponents.labels.youHaveUnsavedChangesThatWillBeLostIfYouLeaveThisPageWouldYouLikeToSaveYourChangesFirst",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>
            {translate("untranslatedComponents.labels.discardChanges")}
          </AlertDialogCancel>
          {onSave && (
            <AlertDialogAction onClick={handleSave} disabled={isSaving}>
              {isSaving
                ? translate("untranslatedComponents.labels.saving")
                : translate("untranslatedComponents.labels.saveChanges")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
