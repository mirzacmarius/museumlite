"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function DeaccessionDetailPage() {
  const params = useParams();
  const deaccessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();

  const deaccession = useQuery(
    api.deaccessions.get,
    deaccessionId
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  const collection = useQuery(
    api.collections.get,
    deaccession ? { collectionId: deaccession.collectionId } : "skip",
  );

  const workflowHistory = useQuery(
    api.deaccessions.getWorkflowHistory,
    deaccessionId
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  const [comment, setComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const approve = useMutation(api.deaccessions.approve);
  const reject = useMutation(api.deaccessions.reject);

  useEffect(() => {
    setComment("");
    setIsApproving(false);
    setIsRejecting(false);
  }, [deaccessionId]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Please select an organization</p>
      </div>
    );
  }

  if (deaccession === undefined || collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (deaccession === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Deaccession not found</p>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approve({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        comment: comment || undefined,
      });
      setComment("");
      // Show success - toast would go here
    } catch (error) {
      console.error("Failed to approve:", error);
      // Show error - toast would go here
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await reject({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        comment: comment || undefined,
      });
      setComment("");
      // Show success - toast would go here
    } catch (error) {
      console.error("Failed to reject:", error);
      // Show error - toast would go here
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-600">
            <Clock className="mr-1.5 h-4 w-4" />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-600">
            <CheckCircle className="mr-1.5 h-4 w-4" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-sm font-medium text-red-600">
            <XCircle className="mr-1.5 h-4 w-4" />
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col gap-6">
          {/* Back button */}
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/deaccessions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Deaccessions
            </Link>
          </Button>

          {/* Deaccession Info Card */}
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold">
                  {deaccession.deaccessionNumber}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {format(
                    new Date(deaccession.dateDeaccessioned),
                    "MMMM d, yyyy",
                  )}
                </p>
              </div>
              {getStatusBadge(deaccession.status)}
            </div>

            <div className="grid gap-4">
              <div>
                <Label className="text-muted-foreground">Reason</Label>
                <p className="mt-1 whitespace-pre-wrap">{deaccession.reason}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Method</Label>
                <p className="mt-1 capitalize">{deaccession.method}</p>
              </div>

              {deaccession.disposition && (
                <div>
                  <Label className="text-muted-foreground">Disposition</Label>
                  <p className="mt-1 whitespace-pre-wrap">
                    {deaccession.disposition}
                  </p>
                </div>
              )}

              {deaccession.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1 whitespace-pre-wrap">
                    {deaccession.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Collection Info Card */}
          {collection && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Collection Object</h3>
              <Link
                href={`/collections/${collection._id}`}
                className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex-1">
                  <h4 className="font-medium">{collection.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {collection.accessionNumber}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize mt-1">
                    Status: {collection.status}
                  </p>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180 flex-shrink-0" />
              </Link>
            </div>
          )}

          {/* Workflow Timeline */}
          {workflowHistory && workflowHistory.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Workflow History</h3>
              <div className="space-y-4">
                {workflowHistory.map((entry, index) => (
                  <div
                    key={`${entry.step}-${entry.approvedAt}`}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium flex-shrink-0">
                        {entry.step}
                      </div>
                      {index < workflowHistory.length - 1 && (
                        <div className="flex-1 w-px bg-border mt-2 min-h-[40px]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium">
                        {entry.step === 0
                          ? "Created"
                          : `Step ${entry.step} - Approved`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.approverName || "Unknown"} •{" "}
                        {format(
                          new Date(entry.approvedAt),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                      </p>
                      {entry.comment && (
                        <p className="mt-2 text-sm italic bg-muted/50 p-2 rounded">
                          {entry.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Actions */}
          {deaccession.status === "pending" && (
            <PermissionGate permission="collections.approve_deaccession">
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Approval Action</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comment">Comment (optional)</Label>
                    <Textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment about your decision..."
                      rows={3}
                      disabled={isApproving || isRejecting}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={isApproving || isRejecting}
                    >
                      {isApproving && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {!isApproving && <CheckCircle className="mr-2 h-4 w-4" />}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isApproving || isRejecting}
                    >
                      {isRejecting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {!isRejecting && <XCircle className="mr-2 h-4 w-4" />}
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            </PermissionGate>
          )}
        </div>
      </div>
    </div>
  );
}
