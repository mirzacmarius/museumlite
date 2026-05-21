"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { MoveRequestSubmitAction } from "./use-move-request-detail";

interface MoveRequestActionsPanelContextValue {
  reviewNotes: string;
  onReviewNotesChange: (value: string) => void;
  isSubmitting: MoveRequestSubmitAction;
  canSourceApproveOrReject: boolean;
  canTargetAcceptOrReject: boolean;
  canCancel: boolean;
  onApprove: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
}

const MoveRequestActionsPanelContext =
  createContext<MoveRequestActionsPanelContextValue | null>(null);

function useMoveRequestActionsPanel() {
  const context = useContext(MoveRequestActionsPanelContext);
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
  isSubmitting: MoveRequestSubmitAction;
  canSourceApproveOrReject: boolean;
  canTargetAcceptOrReject: boolean;
  canCancel: boolean;
  onApprove: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

function MoveRequestActionsPanelProvider({
  reviewNotes,
  onReviewNotesChange,
  isSubmitting,
  canSourceApproveOrReject,
  canTargetAcceptOrReject,
  canCancel,
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
      isSubmitting,
      canSourceApproveOrReject,
      canTargetAcceptOrReject,
      canCancel,
      onApprove,
      onAccept,
      onReject,
      onCancel,
    }),
    [
      reviewNotes,
      onReviewNotesChange,
      isSubmitting,
      canSourceApproveOrReject,
      canTargetAcceptOrReject,
      canCancel,
      onApprove,
      onAccept,
      onReject,
      onCancel,
    ],
  );

  if (!canSourceApproveOrReject && !canTargetAcceptOrReject && !canCancel) {
    return null;
  }

  const showReviewNotes =
    canSourceApproveOrReject || canTargetAcceptOrReject;

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
                onChange={(event) =>
                  onReviewNotesChange(event.target.value)
                }
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
  const {
    isSubmitting,
    canSourceApproveOrReject,
    canTargetAcceptOrReject,
    onApprove,
    onReject,
  } = useMoveRequestActionsPanel();

  if (!canSourceApproveOrReject && !canTargetAcceptOrReject) return null;

  return (
    <>
      {canSourceApproveOrReject && (
        <Button onClick={onApprove} disabled={isSubmitting !== null}>
          {isSubmitting === "approve" && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Approve for transfer
        </Button>
      )}
      <Button
        variant="destructive"
        onClick={onReject}
        disabled={isSubmitting !== null}
      >
        {isSubmitting === "reject" && (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        Reject request
      </Button>
    </>
  );
}

function MoveRequestActionsPanelTargetActions() {
  const { isSubmitting, canTargetAcceptOrReject, onAccept } =
    useMoveRequestActionsPanel();

  if (!canTargetAcceptOrReject) return null;

  return (
    <Button onClick={onAccept} disabled={isSubmitting !== null}>
      {isSubmitting === "accept" && (
        <Loader2 className="mr-2 size-4 animate-spin" />
      )}
      Accept and complete transfer
    </Button>
  );
}

function MoveRequestActionsPanelCancelAction() {
  const { isSubmitting, canCancel, onCancel } = useMoveRequestActionsPanel();

  if (!canCancel) return null;

  return (
    <Button
      variant="outline"
      onClick={onCancel}
      disabled={isSubmitting !== null}
    >
      {isSubmitting === "cancel" && (
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
