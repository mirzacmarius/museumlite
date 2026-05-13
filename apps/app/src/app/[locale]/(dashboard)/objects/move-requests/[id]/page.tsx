"use client";

import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { formatDateFns } from "@/lib/format-date";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
    case "pending_source_approval":
      return (
        <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
          <Clock className="mr-1 h-3 w-3" />
          Pending transfer approval
        </Badge>
      );
    case "approved_for_transfer":
    case "awaiting_acceptance":
      return (
        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
          <Clock className="mr-1 h-3 w-3" />
          Awaiting acceptance
        </Badge>
      );
    case "executed":
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
          <CheckCircle className="mr-1 h-3 w-3" />
          Executed
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/10">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary">
          <XCircle className="mr-1 h-3 w-3" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function formatAccessionMode(mode: string) {
  switch (mode) {
    case "keep":
      return "Keep current accession number";
    case "auto":
      return "Generate a new accession number";
    case "manual":
      return "Use the requested accession number";
    default:
      return mode;
  }
}

export default function MoveRequestDetailPage() {
  const params = useParams();
  const locale = useCurrentLocale();
  const { currentOrganizationId } = useOrganization();
  const { hasPermission } = usePermissions();
  const requestId = params.id as string;

  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<
    null | "approve" | "accept" | "reject" | "cancel"
  >(null);

  const request = useQuery(
    api.objectMoves.get,
    requestId
      ? { requestId: requestId as Id<"organizationMoveRequests"> }
      : "skip",
  );
  const currentUser = useQuery(api.users.getUser, {});

  const approve = useMutation(api.objectMoves.approve);
  const accept = useMutation(api.objectMoves.accept);
  const reject = useMutation(api.objectMoves.reject);
  const cancel = useMutation(api.objectMoves.cancel);

  const isRequester = request?.requestedBy === currentUser?._id;
  const isSourceAdmin =
    currentOrganizationId === request?.sourceOrganization?._id &&
    hasPermission("organization.manage_settings");
  const isTargetAdmin =
    currentOrganizationId === request?.targetOrganization?._id &&
    hasPermission("organization.manage_settings");
  const canSourceApproveOrReject =
    request?.status === "pending_source_approval" && isSourceAdmin;
  const canTargetAcceptOrReject =
    request?.status === "awaiting_acceptance" && isTargetAdmin;
  const canCancel =
    request?.status === "pending_source_approval" &&
    (isRequester || isSourceAdmin);

  const accessionSummary = useMemo(() => {
    if (!request) {
      return null;
    }

    if (request.accessionMode === "keep") {
      return request.sourceAccessionNumber;
    }

    if (request.finalAccessionNumber) {
      return request.finalAccessionNumber;
    }

    if (request.requestedAccessionNumber) {
      return request.requestedAccessionNumber;
    }

    return "Will be generated on approval";
  }, [request]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Select an organization to continue.
        </p>
      </div>
    );
  }

  if (request === undefined || currentUser === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading move request...</p>
      </div>
    );
  }

  if (request === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Move request not found.</p>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsSubmitting("approve");
    try {
      await approve({
        requestId: request._id,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      setReviewNotes("");
      toast.success("Transfer approved and sent for acceptance.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to approve move request.",
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleAccept = async () => {
    setIsSubmitting("accept");
    try {
      await accept({
        requestId: request._id,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      setReviewNotes("");
      toast.success("Transfer accepted and completed.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to accept transfer request.",
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!reviewNotes.trim()) {
      toast.error("Review notes are required to reject a move request.");
      return;
    }

    setIsSubmitting("reject");
    try {
      await reject({
        requestId: request._id,
        reviewNotes: reviewNotes.trim(),
      });
      setReviewNotes("");
      toast.success("Move request rejected.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to reject move request.",
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCancel = async () => {
    setIsSubmitting("cancel");
    try {
      await cancel({ requestId: request._id });
      toast.success("Move request cancelled.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to cancel move request.",
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-6 py-6">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/objects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to objects
            </Link>
          </Button>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRightLeft className="h-4 w-4" />
                  Object move request
                </div>
                <h1 className="text-2xl font-semibold">
                  {request.collection?.title ?? "Unknown object"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {request.sourceAccessionNumber}
                </p>
              </div>
              {getStatusBadge(request.status)}
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">From</Label>
                  <p className="mt-1">
                    {request.sourceOrganization?.name ?? "Unknown organization"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">To</Label>
                  <p className="mt-1">
                    {request.targetOrganization?.name ?? "Unknown organization"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Accession handling
                  </Label>
                  <p className="mt-1">
                    {formatAccessionMode(request.accessionMode)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Resulting accession number
                  </Label>
                  <p className="mt-1 font-mono text-sm">{accessionSummary}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Requested by</Label>
                  <p className="mt-1">
                    {request.requestedByUser?.name ??
                      request.requestedByUser?.username ??
                      "Unknown user"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Requested at</Label>
                  <p className="mt-1">
                    {formatDateFns(
                      new Date(request.requestedAt),
                      "MMMM d, yyyy 'at' p",
                      locale,
                    )}
                  </p>
                </div>
                {request.sourceReviewedAt && (
                  <div>
                    <Label className="text-muted-foreground">
                      Source approved at
                    </Label>
                    <p className="mt-1">
                      {formatDateFns(
                        new Date(request.sourceReviewedAt),
                        "MMMM d, yyyy 'at' p",
                        locale,
                      )}
                    </p>
                  </div>
                )}
                {request.targetReviewedAt && (
                  <div>
                    <Label className="text-muted-foreground">
                      Target reviewed at
                    </Label>
                    <p className="mt-1">
                      {formatDateFns(
                        new Date(request.targetReviewedAt),
                        "MMMM d, yyyy 'at' p",
                        locale,
                      )}
                    </p>
                  </div>
                )}
                {request.executedAt && (
                  <div>
                    <Label className="text-muted-foreground">Executed at</Label>
                    <p className="mt-1">
                      {formatDateFns(
                        new Date(request.executedAt),
                        "MMMM d, yyyy 'at' p",
                        locale,
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <Label className="text-muted-foreground">Reason for move</Label>
                <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
              </div>

              {request.notes && (
                <div>
                  <Label className="text-muted-foreground">
                    Additional notes
                  </Label>
                  <p className="mt-1 whitespace-pre-wrap">{request.notes}</p>
                </div>
              )}

              {(request.sourceReviewNotes || request.targetReviewNotes) && (
                <div>
                  <Label className="text-muted-foreground">Review notes</Label>
                  <p className="mt-1 whitespace-pre-wrap">
                    {request.targetReviewNotes ?? request.sourceReviewNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {request.collection?._id && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Object</h2>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{request.collection.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.collection.accessionNumber}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/objects/${request.collection._id}`}>
                    Open object
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {(canSourceApproveOrReject ||
            canTargetAcceptOrReject ||
            canCancel) && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Actions</h2>
              <div className="mt-4 space-y-4">
                {(canSourceApproveOrReject || canTargetAcceptOrReject) && (
                  <div className="space-y-2">
                    <Label htmlFor="reviewNotes">Review notes</Label>
                    <Textarea
                      id="reviewNotes"
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      placeholder="Add notes for the requester or approval record"
                      rows={4}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {canSourceApproveOrReject && (
                    <Button
                      onClick={handleApprove}
                      disabled={isSubmitting !== null}
                    >
                      {isSubmitting === "approve" && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Approve for transfer
                    </Button>
                  )}
                  {canTargetAcceptOrReject && (
                    <Button
                      onClick={handleAccept}
                      disabled={isSubmitting !== null}
                    >
                      {isSubmitting === "accept" && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Accept and complete transfer
                    </Button>
                  )}
                  {(canSourceApproveOrReject || canTargetAcceptOrReject) && (
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isSubmitting !== null}
                    >
                      {isSubmitting === "reject" && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Reject request
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSubmitting !== null}
                    >
                      {isSubmitting === "cancel" && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Cancel request
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
