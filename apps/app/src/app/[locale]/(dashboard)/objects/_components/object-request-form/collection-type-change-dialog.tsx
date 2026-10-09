"use client";

import {
  type CollectionType,
  isCollectionModuleId,
} from "@v1/backend/convex/utils/moduleCatalog";
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
import { useTypeDetailFieldSpecs } from "../object-type-details/use-type-detail-field-specs";

interface CollectionTypeChangeDialogProps {
  currentCollectionType: CollectionType | undefined;
  pendingCollectionType: CollectionType | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirms a collection type change that removes the draft's details. */
export function CollectionTypeChangeDialog({
  currentCollectionType,
  pendingCollectionType,
  onConfirm,
  onCancel,
}: CollectionTypeChangeDialogProps) {
  const t = useI18n();
  const { typeLabels } = useTypeDetailFieldSpecs();
  const currentTypeLabel = isCollectionModuleId(currentCollectionType)
    ? typeLabels[currentCollectionType]
    : "";

  return (
    <AlertDialog
      open={pendingCollectionType !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("objectTypeDetails.changeType.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("objectTypeDetails.changeType.description", {
              type: currentTypeLabel,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("objectTypeDetails.changeType.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("objectTypeDetails.changeType.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
