"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useOrganization } from "@/components/organization-provider";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { DeaccessionDetailBoardReportDialog } from "./deaccession-detail-board-report-dialog";
import { DeaccessionDetailMainContent } from "./deaccession-detail-main-content";
import {
  formatDeaccessionStatusLabel,
  getDeaccessionActionLabel,
} from "./deaccession-detail-types";
import { disposalStageErrorMessage } from "./disposal-stage-error";

export function DeaccessionDetailPageClient() {
  const params = useParams();
  const deaccessionId = params.id as string;

  return (
    <DeaccessionDetailPageInner
      key={deaccessionId}
      deaccessionId={deaccessionId}
    />
  );
}

function DeaccessionDetailPageInner({
  deaccessionId,
}: {
  deaccessionId: string;
}) {
  const locale = useCurrentLocale();
  const tRoot = useI18n();
  const t = useScopedI18n("deaccessions");
  const tCommon = useScopedI18n("common");
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
  const collectionThumbnail = useQuery(
    api.collections.getThumbnail,
    deaccession ? { collectionId: deaccession.collectionId } : "skip",
  );

  const workflowHistoryPage = useQuery(
    api.deaccessions.getWorkflowHistory,
    deaccession ? { deaccessionId: deaccession._id } : "skip",
  );
  const viewState = useRecordViewState(deaccession);

  const workflowHistory = workflowHistoryPage?.entries;

  // Both inputs are sent with the approval or rejection decision.
  const [decisionInput, setDecisionInput] = useState({
    comment: "",
    exceptionReason: "",
  });
  const { comment, exceptionReason } = decisionInput;
  const setComment = (value: string) =>
    setDecisionInput((current) => ({ ...current, comment: value }));
  const setExceptionReason = (value: string) =>
    setDecisionInput((current) => ({ ...current, exceptionReason: value }));
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const approve = useMutation(api.deaccessions.approve);
  const reject = useMutation(api.deaccessions.reject);

  const exportData = useQuery(
    api.deaccessions.getExportData,
    deaccessionId && isPrintModalOpen
      ? { deaccessionId: deaccessionId as Id<"deaccessions"> }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("detail.selectOrg")}</p>
      </div>
    );
  }

  if (deaccession === null) {
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="deaccessions"
      />
    );
  }

  if (deaccession === undefined || collection === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  const actionLabel = getDeaccessionActionLabel(deaccession, tRoot);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approve({
        deaccessionId: deaccessionId as Id<"deaccessions">,
        comment: comment || undefined,
        exceptionReason: exceptionReason.trim() || undefined,
      });
      setDecisionInput({ comment: "", exceptionReason: "" });
    } catch (error) {
      toast.error(
        disposalStageErrorMessage(error, t("stages.approval.failed")),
      );
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
    } catch (error) {
      toast.error(
        disposalStageErrorMessage(error, t("stages.approval.failed")),
      );
    } finally {
      setIsRejecting(false);
    }
  };

  const collectionStatusLabel = collection
    ? formatDeaccessionStatusLabel(collection.status, tRoot)
    : null;
  const workflowEntryCount = workflowHistory?.length ?? 0;
  const reviewStateLabel =
    deaccession.status === "pending"
      ? "Awaiting review"
      : deaccession.status === "approved"
        ? "Approved"
        : "Rejected";

  const viewProps = {
    deaccessionId,
    locale,
    deaccession,
    collection,
    collectionThumbnailUrl: collectionThumbnail?.thumbnailUrl,
    actionLabel,
    collectionStatusLabel,
    reviewStateLabel,
    workflowHistory,
    workflowEntryCount,
    comment,
    setComment,
    exceptionReason,
    setExceptionReason,
    isApproving,
    isRejecting,
    handleApprove,
    handleReject,
    isPrintModalOpen,
    setIsPrintModalOpen,
    exportData,
  };

  return (
    <>
      <DeaccessionDetailMainContent {...viewProps} />
      <DeaccessionDetailBoardReportDialog {...viewProps} />
    </>
  );
}
