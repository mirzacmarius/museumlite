"use client";

import { Button } from "@v1/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { MoveRequestActionsPanel } from "./move-request-actions-panel";
import { MoveRequestDetailCard } from "./move-request-detail-card";
import { MoveRequestObjectLink } from "./move-request-object-link";
import { useMoveRequestDetail } from "./use-move-request-detail";
export function MoveRequestDetailPageClient() {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const {
    currentOrganizationId,
    request,
    currentUser,
    reviewNotes,
    setReviewNotes,
    targetLocationId,
    setTargetLocationId,
    isSubmitting,
    accessionSummary,
    permissions,
    handleApprove,
    handleAccept,
    handleReject,
    handleCancel,
  } = useMoveRequestDetail();

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("collections.selectOrganizationContinue")}
        </p>
      </div>
    );
  }

  if (request === undefined || currentUser === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.objects.move.loading")}
        </p>
      </div>
    );
  }

  if (request === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.objects.move.notFound")}
        </p>
      </div>
    );
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-6 py-6">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/objects">
              <ArrowLeft className="mr-2 size-4" />
              {tRoot("untranslatedRecords.objects.move.backToObjects")}
            </Link>
          </Button>

          <MoveRequestDetailCard
            request={request}
            locale={locale}
            accessionSummary={accessionSummary}
          />

          <MoveRequestObjectLink request={request} />

          <MoveRequestActionsPanel
            reviewNotes={reviewNotes}
            onReviewNotesChange={setReviewNotes}
            targetLocationId={targetLocationId}
            onTargetLocationChange={setTargetLocationId}
            targetOrganizationId={request.targetOrganizationId}
            submittingAction={isSubmitting}
            availableActions={{
              sourceReview: permissions.canSourceApproveOrReject,
              targetReview: permissions.canTargetAcceptOrReject,
              cancel: permissions.canCancel,
            }}
            onApprove={() => handleApprove(request)}
            onAccept={() => handleAccept(request)}
            onReject={() => handleReject(request)}
            onCancel={() => handleCancel(request)}
          />
        </div>
      </div>
    </main>
  );
}
