"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

interface ApprovalWorkflowProps {
  accessionId: string;
}

export function ApprovalWorkflow({ accessionId }: ApprovalWorkflowProps) {
  const { currentOrganizationId } = useOrganization();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );

  const approveAccession = useMutation(api.accessions.approve);
  const rejectAccession = useMutation(api.accessions.reject);

  if (!accession || accession.status !== "pending") {
    return null;
  }

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await approveAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
      });
      setComment("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve accession",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await rejectAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
      });
      setComment("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reject accession",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Approval Actions</h3>
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <Label htmlFor="comment">Comment (optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment or reason for approval/rejection..."
            rows={3}
          />
        </div>
        <div className="flex gap-4">
          <PermissionGate permission="collections.approve_accession">
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {accession.workflowStep
                ? `Approve Step ${accession.workflowStep}`
                : "Approve"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isSubmitting} variant="destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject Accession</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to reject this accession? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReject}>
                    Reject Accession
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
