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
  return (
    <AlertDialog
      open={!!conditionToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {conditionUsage?.isUsed
              ? "Cannot Delete Condition"
              : "Delete Condition"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {conditionUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  The condition{" "}
                  <span className="font-semibold text-foreground">
                    "{conditionToDelete?.name}"
                  </span>{" "}
                  cannot be deleted because it is currently being used by{" "}
                  {conditionUsage.usageCount}{" "}
                  {conditionUsage.usageCount === 1
                    ? "collection"
                    : "collections"}
                  .
                </div>
                {conditionUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Used in:</div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {conditionUsage.collectionNames
                        .slice(0, 5)
                        .map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      {conditionUsage.collectionNames.length > 5 && (
                        <li className="italic">
                          ...and {conditionUsage.collectionNames.length - 5}{" "}
                          more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  "{conditionToDelete?.name}"
                </span>
                ? This action cannot be undone.
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {conditionUsage?.isUsed ? (
            <AlertDialogCancel>Close</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
