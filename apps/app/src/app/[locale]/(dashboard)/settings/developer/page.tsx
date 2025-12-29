"use client";

import { PermissionGate } from "@/components/permission-gate";
import { useOrganization } from "@/components/organization-provider";
import { api } from "@v1/backend/convex/_generated/api";
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
import { useMutation } from "convex/react";
import { AlertTriangle, Trash2, Database } from "lucide-react";
import { useState } from "react";

export default function DeveloperUtilitiesPage() {
  const { currentOrganizationId } = useOrganization();
  const [isDeletingLoans, setIsDeletingLoans] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    deletedLoans: number;
    deletedLoanItems: number;
    updatedCollections: number;
  } | null>(null);

  const deleteAllLoans = useMutation(api.loans.deleteAllLoans);

  const handleDeleteAllLoans = async () => {
    if (!currentOrganizationId) return;

    setIsDeletingLoans(true);
    setDeleteResult(null);
    try {
      const result = await deleteAllLoans({
        organizationId: currentOrganizationId as Id<"organizations">,
      });
      setDeleteResult(result);
    } catch (error) {
      console.error("Error deleting loans:", error);
      alert(error instanceof Error ? error.message : "Failed to delete loans");
    } finally {
      setIsDeletingLoans(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer Utilities</h1>
        <p className="text-muted-foreground mt-2">
          Administrative tools for testing and development. Use with caution.
        </p>
      </div>

      <div className="space-y-6">
        {/* Delete All Loans Section */}
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-destructive/10 p-2">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="text-lg font-semibold">Delete All Loans</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all loans, loan items, and restore collection statuses to "active".
                  This action cannot be undone.
                </p>
              </div>

              {deleteResult && (
                <div className="rounded-md bg-muted p-4 space-y-1">
                  <p className="text-sm font-medium">Operation completed:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Deleted {deleteResult.deletedLoans} loan{deleteResult.deletedLoans !== 1 ? "s" : ""}</li>
                    <li>Deleted {deleteResult.deletedLoanItems} loan item{deleteResult.deletedLoanItems !== 1 ? "s" : ""}</li>
                    <li>Updated {deleteResult.updatedCollections} collection{deleteResult.updatedCollections !== 1 ? "s" : ""} status to active</li>
                  </ul>
                </div>
              )}

              <PermissionGate permission="loans.update">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeletingLoans || !currentOrganizationId}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isDeletingLoans ? "Deleting..." : "Delete All Loans"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Delete All Loans?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p className="font-medium">This will permanently delete:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>All loans in your organization</li>
                          <li>All loan items</li>
                          <li>Restore all collection statuses to "active"</li>
                        </ul>
                        <p className="pt-2 font-semibold text-destructive">
                          This action cannot be undone. Are you absolutely sure?
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAllLoans}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, Delete All Loans
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGate>
            </div>
          </div>
        </div>

        {/* Placeholder for future utilities */}
        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-muted p-2">
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">More Utilities</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Additional developer utilities will be added here as needed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
