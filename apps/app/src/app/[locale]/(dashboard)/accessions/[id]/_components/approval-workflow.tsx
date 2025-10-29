"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery, useMutation } from "convex/react";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";

interface ApprovalWorkflowProps {
  accessionId: string;
}

export function ApprovalWorkflow({ accessionId }: ApprovalWorkflowProps) {
  const { currentOrganizationId } = useOrganization();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as any } : "skip",
  );

  const approveAccession = useMutation(api.accessions.approve);
  const rejectAccession = useMutation(api.accessions.reject);

  if (!accession || accession.status !== "pending") {
    return null;
  }

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approveAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
      });
      setComment("");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to approve accession",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this accession?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
      });
      setComment("");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Failed to reject accession",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Approval Actions</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="comment" className="text-sm font-medium">
            Comment (optional)
          </label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment or reason for approval/rejection..."
            className="mt-2 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
            <Button
              onClick={handleReject}
              disabled={isSubmitting}
              variant="destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}

