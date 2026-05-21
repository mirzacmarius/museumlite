"use client";

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
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";

interface AccountDetailHeaderProps {
  accountId: Id<"accounts">;
  businessName: string | undefined;
  accountNumber: string;
  isDeleting: boolean;
  onDelete: () => void;
}

export function AccountDetailHeader({
  accountId,
  businessName,
  accountNumber,
  isDeleting,
  onDelete,
}: AccountDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium">{businessName}</h1>
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            Account: {accountNumber}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <PermissionGate permission="loans.update">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/accounts/${accountId}/edit`}>
              <Edit className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        </PermissionGate>
        <PermissionGate permission="loans.update">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{businessName}"? This action
                  cannot be undone. If this account is used in any loans, it
                  cannot be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </PermissionGate>
      </div>
    </div>
  );
}
