"use client";

import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type MoveRequestDetail = NonNullable<
  FunctionReturnType<typeof api.objectMoves.get>
>;

export type MoveRequestSubmitAction =
  | "approve"
  | "accept"
  | "reject"
  | "cancel"
  | null;

export function useMoveRequestDetail() {
  const params = useParams();
  const { currentOrganizationId } = useOrganization();
  const { hasPermission } = usePermissions();
  const requestId = params.id as string;

  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState<MoveRequestSubmitAction>(null);

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

  const permissions = useMemo(() => {
    if (!request || !currentUser) {
      return {
        canSourceApproveOrReject: false,
        canTargetAcceptOrReject: false,
        canCancel: false,
      };
    }

    const isRequester = request.requestedBy === currentUser._id;
    const isSourceAdmin =
      currentOrganizationId === request.sourceOrganization?._id &&
      hasPermission("organization.manage_settings");
    const isTargetAdmin =
      currentOrganizationId === request.targetOrganization?._id &&
      hasPermission("organization.manage_settings");

    return {
      canSourceApproveOrReject:
        request.status === "pending_source_approval" && isSourceAdmin,
      canTargetAcceptOrReject:
        request.status === "awaiting_acceptance" && isTargetAdmin,
      canCancel:
        request.status === "pending_source_approval" &&
        (isRequester || isSourceAdmin),
    };
  }, [currentOrganizationId, currentUser, hasPermission, request]);

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

  const handleApprove = async (moveRequest: MoveRequestDetail) => {
    setIsSubmitting("approve");
    try {
      await approve({
        requestId: moveRequest._id,
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

  const handleAccept = async (moveRequest: MoveRequestDetail) => {
    setIsSubmitting("accept");
    try {
      await accept({
        requestId: moveRequest._id,
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

  const handleReject = async (moveRequest: MoveRequestDetail) => {
    if (!reviewNotes.trim()) {
      toast.error("Review notes are required to reject a move request.");
      return;
    }

    setIsSubmitting("reject");
    try {
      await reject({
        requestId: moveRequest._id,
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

  const handleCancel = async (moveRequest: MoveRequestDetail) => {
    setIsSubmitting("cancel");
    try {
      await cancel({ requestId: moveRequest._id });
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

  return {
    currentOrganizationId,
    request,
    currentUser,
    reviewNotes,
    setReviewNotes,
    isSubmitting,
    accessionSummary,
    permissions,
    handleApprove,
    handleAccept,
    handleReject,
    handleCancel,
  };
}
