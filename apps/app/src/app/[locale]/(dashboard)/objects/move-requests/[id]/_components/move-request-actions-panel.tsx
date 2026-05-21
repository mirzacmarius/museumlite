"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Loader2 } from "lucide-react";
import { createContext, type ReactNode, use, useMemo } from "react";
import type { MoveRequestSubmitAction } from "./use-move-request-detail";

interface MoveRequestActionsPanelAvailability {
  sourceReview: boolean;
  targetReview: boolean;
  cancel: boolean;
}

interface MoveRequestActionsPanelContextValue {
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
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
  submittingAction,
  availableActions,
  onApprove,
  onAccept,
  onReject,
  onCancel,
  children,
}: MoveRequestActionsPanelProps) {
  const value = useMemo(
    () => ({
      reviewNotes,
      onReviewNotesChange,
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
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="mt-4 space-y-4">
          {showReviewNotes && (
            <div className="space-y-2">
              <Label htmlFor="reviewNotes">Review notes</Label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(event) => onReviewNotesChange(event.target.value)}
                placeholder="Add notes for the requester or approval record"
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

function MoveRequestActionsPanelSourceActions() {
  const { submittingAction, availableActions, onApprove, onReject } =
    useMoveRequestActionsPanel();
  const { sourceReview, targetReview } = availableActions;

  if (!sourceReview && !targetReview) return null;

  return (
    <>
      {sourceReview && (
        <Button onClick={onApprove} disabled={submittingAction !== null}>
          {submittingAction === "approve" && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Approve for transfer
        </Button>
      )}
      <Button
        variant="destructive"
        onClick={onReject}
        disabled={submittingAction !== null}
      >
        {submittingAction === "reject" && (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        Reject request
      </Button>
    </>
  );
}

function MoveRequestActionsPanelTargetActions() {
  const { submittingAction, availableActions, onAccept } =
    useMoveRequestActionsPanel();
  const { targetReview } = availableActions;

  if (!targetReview) return null;

  return (
    <Button onClick={onAccept} disabled={submittingAction !== null}>
      {submittingAction === "accept" && (
        <Loader2 className="mr-2 size-4 animate-spin" />
      )}
      Accept and complete transfer
    </Button>
  );
}

function MoveRequestActionsPanelCancelAction() {
  const { submittingAction, availableActions, onCancel } =
    useMoveRequestActionsPanel();
  const { cancel } = availableActions;

  if (!cancel) return null;

  return (
    <Button
      variant="outline"
      onClick={onCancel}
      disabled={submittingAction !== null}
    >
      {submittingAction === "cancel" && (
        <Loader2 className="mr-2 size-4 animate-spin" />
      )}
      Cancel request
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
