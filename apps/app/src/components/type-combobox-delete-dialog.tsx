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
  return (
    <AlertDialog
      open={!!typeToDelete}
      onOpenChange={(open) => !open && onOpenChange(false)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {typeUsage?.isUsed ? "Cannot Delete Type" : "Delete Type"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {typeUsage?.isUsed ? (
              <div className="space-y-2">
                <div>
                  The type{" "}
                  <span className="font-semibold text-foreground">
                    "{typeToDelete?.name}"
                  </span>{" "}
                  cannot be deleted because it is currently being used by{" "}
                  {typeUsage.usageCount}{" "}
                  {typeUsage.usageCount === 1 ? "collection" : "collections"}.
                </div>
                {typeUsage.collectionNames.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium mb-1">Used in:</div>
                    <ul className="text-xs list-disc pl-4 space-y-0.5">
                      {typeUsage.collectionNames.slice(0, 5).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                      {typeUsage.collectionNames.length > 5 && (
                        <li className="italic">
                          ...and {typeUsage.collectionNames.length - 5} more
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
                  "{typeToDelete?.name}"
                </span>
                ? This action cannot be undone.
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {typeUsage?.isUsed ? (
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
