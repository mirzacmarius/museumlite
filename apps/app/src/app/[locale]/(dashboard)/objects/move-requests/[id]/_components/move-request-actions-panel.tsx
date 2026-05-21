"use client";

import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { Loader2 } from "lucide-react";
import type { MoveRequestSubmitAction } from "./use-move-request-detail";

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
}

export function MoveRequestActionsPanel({
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
}: MoveRequestActionsPanelProps) {
  if (!canSourceApproveOrReject && !canTargetAcceptOrReject && !canCancel) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Actions</h2>
      <div className="mt-4 space-y-4">
        {(canSourceApproveOrReject || canTargetAcceptOrReject) && (
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
          {canSourceApproveOrReject && (
            <Button onClick={onApprove} disabled={isSubmitting !== null}>
              {isSubmitting === "approve" && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Approve for transfer
            </Button>
          )}
          {canTargetAcceptOrReject && (
            <Button onClick={onAccept} disabled={isSubmitting !== null}>
              {isSubmitting === "accept" && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Accept and complete transfer
            </Button>
          )}
          {(canSourceApproveOrReject || canTargetAcceptOrReject) && (
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
          )}
          {canCancel && (
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
          )}
        </div>
      </div>
    </div>
  );
}
