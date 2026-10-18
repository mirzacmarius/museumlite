"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Loader2 } from "lucide-react";
import { createContext, type ReactNode, use, useMemo } from "react";
import { LocationSelector } from "@/components/location-selector";
import { useI18n } from "@/locales/client";
import type { MoveRequestSubmitAction } from "./use-move-request-detail";

interface MoveRequestActionsPanelAvailability {
  sourceReview: boolean;
  targetReview: boolean;
  cancel: boolean;
}

interface MoveRequestActionsPanelContextValue {
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
  targetLocationId: string;
  onTargetLocationChange: (value: string) => void;
  targetOrganizationId?: Id<"organizations">;
  submittingAction: MoveRequestSubmitAction;
  availableActions: MoveRequestActionsPanelAvailability;
  onApprove: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

const MoveRequestActionsPanelContext =
  createContext<MoveRequestActionsPanelContextValue | null>(null);

function useMoveRequestActionsPanel() {
  const context = use(MoveRequestActionsPanelContext);
  if (!context) {
    throw new Error(
      "MoveRequestActionsPanel subcomponents must be used within MoveRequestActionsPanel",
    );
  }
  return context;
}

interface MoveRequestActionsPanelProps {
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
  targetLocationId: string;
  onTargetLocationChange: (value: string) => void;
  targetOrganizationId?: Id<"organizations">;
  submittingAction: MoveRequestSubmitAction;
  availableActions: MoveRequestActionsPanelAvailability;
  onApprove: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

function MoveRequestActionsPanelProvider({
  reviewNotes,
  onReviewNotesChange,
  targetLocationId,
  onTargetLocationChange,
  targetOrganizationId,
  submittingAction,
  availableActions,
  onApprove,
  onAccept,
  onReject,
  onCancel,
  children,
}: MoveRequestActionsPanelProps) {
  const tRoot = useI18n();
  const value = useMemo(
    () => ({
      reviewNotes,
      onReviewNotesChange,
      targetLocationId,
      onTargetLocationChange,
      targetOrganizationId,
      submittingAction,
      availableActions,
      onApprove,
      onAccept,
      onReject,
      onCancel,
    }),
    [
      reviewNotes,
      onReviewNotesChange,
      targetLocationId,
      onTargetLocationChange,
      targetOrganizationId,
      submittingAction,
      availableActions,
      onApprove,
      onAccept,
      onReject,
      onCancel,
    ],
  );

  if (
    !availableActions.sourceReview &&
    !availableActions.targetReview &&
    !availableActions.cancel
  ) {
    return null;
  }

  const showReviewNotes =
    availableActions.sourceReview || availableActions.targetReview;

  return (
    <MoveRequestActionsPanelContext.Provider value={value}>
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">
          {tRoot("collections.mediaImport.tableHeaders.actions")}
        </h2>
        <div className="mt-4 space-y-4">
          {showReviewNotes && (
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">
                {tRoot("untranslatedRecords.accessions.transfer.reviewNotes")}
              </Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(event) => onReviewNotesChange(event.target.value)}
                placeholder={tRoot(
                  "untranslatedRecords.objects.detail.additionalNotesHint",
                )}
                rows={4}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {children ?? (
              <>
                <MoveRequestActionsPanel.SourceActions />
                <MoveRequestActionsPanel.TargetActions />
                <MoveRequestActionsPanel.CancelAction />
              </>
            )}
          </div>
        </div>
      </div>
    </MoveRequestActionsPanelContext.Provider>
  );
}

/**
 * Before approval, the requester and source administrators both stop a
 * request with Cancel; Reject is only the receiving organization's decline.
 */
function MoveRequestActionsPanelSourceActions() {
  const tRoot = useI18n();
  const { submittingAction, availableActions, onApprove } =
    useMoveRequestActionsPanel();

  if (!availableActions.sourceReview) return null;

  return (
    <Button onClick={onApprove} disabled={submittingAction !== null}>
      {submittingAction === "approve" && (
        <Loader2 className="mr-2 size-4 animate-spin" />
      )}
      {tRoot("untranslatedRecords.objects.move.approve")}
    </Button>
  );
}

function MoveRequestActionsPanelTargetActions() {
  const tRoot = useI18n();
  const {
    submittingAction,
    availableActions,
    onAccept,
    onReject,
    targetLocationId,
    onTargetLocationChange,
    targetOrganizationId,
  } = useMoveRequestActionsPanel();
  const { targetReview } = availableActions;

  if (!targetReview) return null;

  return (
    <>
      {targetOrganizationId ? (
        <div className="w-full space-y-2">
          <Label>
            {tRoot("untranslatedRecords.objects.transfer.receivingLocation")}
          </Label>
          <LocationSelector
            organizationId={targetOrganizationId}
            value={targetLocationId}
            onValueChange={onTargetLocationChange}
            allowNone={false}
            placeholder={tRoot(
              "untranslatedRecords.objects.transfer.receivingLocationPlaceholder",
            )}
          />
        </div>
      ) : null}
      <Button onClick={onAccept} disabled={submittingAction !== null}>
        {submittingAction === "accept" && (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        {tRoot("untranslatedRecords.objects.move.accept")}
      </Button>
      <Button
        variant="destructive"
        onClick={onReject}
        disabled={submittingAction !== null}
      >
        {submittingAction === "reject" && (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        {tRoot("untranslatedRecords.objects.move.reject")}
      </Button>
    </>
  );
}

function MoveRequestActionsPanelCancelAction() {
  const tRoot = useI18n();
  const { submittingAction, availableActions, onCancel } =
    useMoveRequestActionsPanel();
  const { cancel } = availableActions;

  if (!cancel) return null;

  return (
    <Button
      variant="destructive"
      onClick={onCancel}
      disabled={submittingAction !== null}
    >
      {submittingAction === "cancel" && (
        <Loader2 className="mr-2 size-4 animate-spin" />
      )}
      {tRoot("untranslatedRecords.objects.move.cancel")}
    </Button>
  );
}

export const MoveRequestActionsPanel = Object.assign(
  MoveRequestActionsPanelProvider,
  {
    SourceActions: MoveRequestActionsPanelSourceActions,
    TargetActions: MoveRequestActionsPanelTargetActions,
    CancelAction: MoveRequestActionsPanelCancelAction,
  },
);
