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
  return (
    <AlertDialog
      open={!!materialToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {materialUsage?.isUsed
              ? "Cannot Delete Material"
              : "Delete Material"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {materialUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  The material{" "}
                  <span className="font-semibold text-foreground">
                    "{materialToDelete?.name}"
                  </span>{" "}
                  cannot be deleted because it is currently being used by{" "}
                  {materialUsage.usageCount}{" "}
                  {materialUsage.usageCount === 1
                    ? "collection"
                    : "collections"}
                  .
                </div>
                {materialUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Used in:</div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {materialUsage.collectionNames.slice(0, 5).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                      {materialUsage.collectionNames.length > 5 && (
                        <li className="italic">
                          ...and {materialUsage.collectionNames.length - 5} more
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
                  "{materialToDelete?.name}"
                </span>
                ? This action cannot be undone.
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {materialUsage?.isUsed ? (
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
