"use client";

import { Label } from "@v1/ui/label";
import { ArrowRightLeft } from "lucide-react";
import { ClientDateFns } from "@/components/client-date";
import { useI18n, useScopedI18n } from "@/locales/client";
import { TransferStageBadge } from "./move-request-utils";
import type { MoveRequestDetail } from "./use-move-request-detail";

interface MoveRequestDetailCardProps {
  request: MoveRequestDetail;
  locale: string;
}

export function MoveRequestDetailCard({
  request,
  locale,
}: MoveRequestDetailCardProps) {
  const tRoot = useI18n();
  const tMoves = useScopedI18n("moveRequests");
  const isOpen =
    request.stage === "waiting_for_sender" ||
    request.stage === "waiting_for_receiver";
  // A decline or cancel by the sending organization, dated by the backend.
  const senderDecision =
    request.decision?.decidedBy === "sender" ? request.decision : undefined;
  const reviewNotes = request.decision?.notes ?? request.sourceReviewNotes;
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRightLeft className="size-4" />
            {tRoot("untranslatedRecords.objects.move.requestTitle")}
          </div>
          <h1 className="text-2xl font-semibold">
            {request.collection?.title ??
              tRoot("untranslatedRecords.objects.moveRequest.unknownObject")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {request.sourceAccessionNumber}
          </p>
        </div>
        <TransferStageBadge stage={request.stage} />
      </div>
      {request.awaitsSenderReapproval && (
        <p className="mt-4 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-200">
          {tMoves("reapprovalNote")}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">
              {tRoot("untranslatedRecords.objects.actions.from")}
            </Label>
            <p className="mt-1">
              {request.sourceOrganization?.name ??
                tRoot(
                  "untranslatedRecords.objects.moveRequest.unknownOrganization",
                )}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">
              {tRoot("objects.form.to")}
            </Label>
            <p className="mt-1">
              {request.targetOrganization?.name ??
                tRoot(
                  "untranslatedRecords.objects.moveRequest.unknownOrganization",
                )}
            </p>
          </div>
          {isOpen && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot("untranslatedRecords.accessions.transfer.handling")}
              </Label>
              <p className="mt-1">{tMoves("accession.chosenByReceiver")}</p>
            </div>
          )}
          {request.stage === "received" && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot(
                  "untranslatedRecords.objects.move.resultingAccessionNumber",
                )}
              </Label>
              <p className="mt-1 font-mono text-sm">
                {request.finalAccessionNumber ?? request.sourceAccessionNumber}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground">
              {tRoot("library.acquisitions.labels.requestedBy")}
            </Label>
            <p className="mt-1">
              {request.requestedByUser?.name ??
                request.requestedByUser?.username ??
                tRoot("untranslatedRecords.objects.moveRequest.unknownUser")}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">
              {tRoot("untranslatedRecords.objects.move.requestedAt")}
            </Label>
            <p className="mt-1">
              <ClientDateFns
                timestamp={request.requestedAt}
                format="MMMM d, yyyy 'at' p"
                locale={locale}
              />
            </p>
          </div>
          {request.approvedBySender && request.sourceReviewedAt && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot("untranslatedRecords.objects.move.sourceApprovedAt")}
              </Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={request.sourceReviewedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
          {senderDecision && (
            <div>
              <Label className="text-muted-foreground">
                {request.stage === "cancelled"
                  ? tRoot("untranslatedRecords.objects.move.sourceCancelledAt")
                  : tRoot("untranslatedRecords.objects.move.sourceDeclinedAt")}
              </Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={senderDecision.decidedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
          {request.targetReviewedAt && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot("untranslatedRecords.objects.move.targetReviewedAt")}
              </Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={request.targetReviewedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
          {request.executedAt && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot("untranslatedRecords.objects.move.executedAt")}
              </Label>
              <p className="mt-1">
                <ClientDateFns
                  timestamp={request.executedAt}
                  format="MMMM d, yyyy 'at' p"
                  locale={locale}
                />
              </p>
            </div>
          )}
        </div>
      </div>

      {(request.approvedSourceLocation !== undefined ||
        request.acceptedTargetLocation ||
        (request.transferScopeSnapshot &&
          request.transferScopeSnapshot.collectionGroupIds.length > 0)) && (
        <div className="mt-6 rounded-md border border-white/10 bg-black/40 p-4 space-y-3">
          <p className="text-sm font-medium">
            {tRoot("untranslatedRecords.objects.transfer.custodyEvidence")}
          </p>
          {request.approvedSourceLocation !== undefined && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot("untranslatedRecords.objects.transfer.observedSource")}
              </Label>
              <p className="mt-1">
                {request.approvedSourceLocation === null
                  ? tRoot(
                      "untranslatedRecords.objects.transfer.noRecordedLocation",
                    )
                  : (request.approvedSourceLocation?.name ??
                    tRoot(
                      "untranslatedRecords.objects.moveRequest.unknownOrganization",
                    ))}
              </p>
            </div>
          )}
          {request.acceptedTargetLocation && (
            <div>
              <Label className="text-muted-foreground">
                {tRoot(
                  "untranslatedRecords.objects.transfer.receivingLocation",
                )}
              </Label>
              <p className="mt-1">{request.acceptedTargetLocation.name}</p>
            </div>
          )}
          {request.transferScopeSnapshot &&
            request.transferScopeSnapshot.collectionGroupIds.length > 0 && (
              <div>
                <Label className="text-muted-foreground">
                  {tRoot(
                    "untranslatedRecords.objects.transfer.priorGroupLinks",
                  )}
                </Label>
                <p className="mt-1 text-sm text-white/60">
                  {request.transferScopeSnapshot.collectionGroupIds.length}{" "}
                  {tRoot(
                    "untranslatedRecords.objects.transfer.priorGroupLinksCount",
                  )}
                </p>
              </div>
            )}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <Label className="text-muted-foreground">
            {tRoot("untranslatedRecords.objects.move.reason")}
          </Label>
          <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
        </div>

        {request.notes && (
          <div>
            <Label className="text-muted-foreground">
              {tRoot("untranslatedRecords.objects.detail.additionalNotes")}
            </Label>
            <p className="mt-1 whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}

        {reviewNotes && (
          <div>
            <Label className="text-muted-foreground">
              {tRoot("untranslatedRecords.accessions.transfer.reviewNotes")}
            </Label>
            <p className="mt-1 whitespace-pre-wrap">{reviewNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
