"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { TransferViewerAction } from "@v1/backend/convex/utils/transferStages";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { AccessionMode } from "@/components/deaccession-dialog-types";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useObjectMoveErrorMessage } from "@/hooks/use-object-move-error-message";
import { useI18n } from "@/locales/client";

export type MoveRequestDetail = NonNullable<
  FunctionReturnType<typeof api.objectMoves.get>
>;

export type MoveRequestSubmitAction = TransferViewerAction["action"] | null;

export function useMoveRequestDetail() {
  const tRoot = useI18n();
  const errorMessage = useObjectMoveErrorMessage();
  const params = useParams();
  const { currentOrganizationId } = useOrganization();
  const { hasPermission } = usePermissions();
  const requestId = params.id as string;

  const [reviewNotes, setReviewNotes] = useState("");
  const [targetLocationId, setTargetLocationId] = useState("");
  // Unset until the receiver picks, so the default below shows.
  const [chosenAccessionMode, setChosenAccessionMode] =
    useState<AccessionMode | null>(null);
  const [chosenAccessionNumber, setChosenAccessionNumber] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] =
    useState<MoveRequestSubmitAction>(null);

  const request = useQuery(
    api.objectMoves.get,
    requestId
      ? { requestId: requestId as Id<"organizationMoveRequests"> }
      : "skip",
  );

  const approve = useMutation(api.objectMoves.approve);
  const accept = useMutation(api.objectMoves.accept);
  const reject = useMutation(api.objectMoves.reject);
  const cancel = useMutation(api.objectMoves.cancel);

  // The Transfers board is for the organization's transfer managers. What
  // the viewer may do with this transfer is the backend's `actions`.
  const canOpenTransfers = hasPermission("organization.manage_settings");

  // Senders never choose, so a stored "keep" is only the request's default:
  // the receiver starts from a newly generated number when it can generate
  // one, and otherwise keeps the current number.
  const accessionMode =
    chosenAccessionMode ??
    (request?.accessionMode === "manual"
      ? "manual"
      : request?.receiverGeneratesAccessionNumbers
        ? "auto"
        : "keep");
  const manualAccessionNumber =
    chosenAccessionNumber ?? request?.requestedAccessionNumber ?? "";

  const handleApprove = async (moveRequest: MoveRequestDetail) => {
    setIsSubmitting("approve");
    try {
      await approve({
        requestId: moveRequest._id,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      setReviewNotes("");
      toast.success(tRoot("untranslatedRecords.objects.transfer.moveApproved"));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          tRoot("untranslatedRecords.objects.transfer.failedApprove"),
        ),
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
        targetLocationId: targetLocationId
          ? (targetLocationId as Id<"locations">)
          : undefined,
        reviewNotes: reviewNotes.trim() || undefined,
        accessionMode,
        requestedAccessionNumber:
          accessionMode === "manual" ? manualAccessionNumber.trim() : undefined,
      });
      setReviewNotes("");
      toast.success(tRoot("untranslatedRecords.objects.transfer.moveAccepted"));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          tRoot("untranslatedRecords.objects.transfer.failedAccept"),
        ),
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleDecline = async (moveRequest: MoveRequestDetail) => {
    setIsSubmitting("decline");
    try {
      await reject({
        requestId: moveRequest._id,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      setReviewNotes("");
      toast.success(tRoot("untranslatedRecords.objects.transfer.moveRejected"));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          tRoot("untranslatedRecords.objects.transfer.failedReject"),
        ),
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCancel = async (moveRequest: MoveRequestDetail) => {
    setIsSubmitting("cancel");
    try {
      await cancel({
        requestId: moveRequest._id,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      setReviewNotes("");
      toast.success(
        tRoot("untranslatedRecords.objects.transfer.moveCancelled"),
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          tRoot("untranslatedRecords.objects.transfer.failedCancel"),
        ),
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  return {
    currentOrganizationId,
    request,
    reviewNotes,
    setReviewNotes,
    targetLocationId,
    setTargetLocationId,
    accessionMode,
    setAccessionMode: setChosenAccessionMode,
    manualAccessionNumber,
    setManualAccessionNumber: setChosenAccessionNumber,
    isSubmitting,
    canOpenTransfers,
    handleApprove,
    handleAccept,
    handleDecline,
    handleCancel,
  };
}
