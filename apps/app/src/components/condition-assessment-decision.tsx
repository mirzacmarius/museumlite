"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { MAX_REJECTION_REASON_LENGTH } from "@v1/backend/convex/utils/conditionAssessmentStatus";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { useConditionAssessmentErrorMessage } from "@/hooks/use-condition-assessment-error-message";
import { useScopedI18n } from "@/locales/client";

export type ConditionAssessmentDecisionKind = "accepted" | "rejected";

/**
 * Accept and Reject for one assessment awaiting approval, or only Reject for
 * a draft nobody will finish. Rejecting asks for an optional reason first. A
 * refusal is explained next to the buttons.
 */
export function ConditionAssessmentDecision({
  assessmentId,
  status,
  onDecided,
  className,
}: {
  assessmentId: Id<"conditionAssessments">;
  status: "draft" | "submitted";
  onDecided?: (decision: ConditionAssessmentDecisionKind) => void;
  className?: string;
}) {
  const t = useScopedI18n("conditionAssessments");
  const tCommon = useScopedI18n("common");
  const errorMessage = useConditionAssessmentErrorMessage();
  const accept = useMutation(api.conditionAssessments.accept);
  const reject = useMutation(api.conditionAssessments.reject);
  const reasonId = useId();
  const [busy, setBusy] = useState<ConditionAssessmentDecisionKind | null>(
    null,
  );
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function decide(decision: ConditionAssessmentDecisionKind) {
    setRefusal(null);
    setBusy(decision);
    try {
      if (decision === "accepted") {
        await accept({ assessmentId });
      } else {
        const trimmed = reason.trim();
        await reject({
          assessmentId,
          ...(trimmed ? { reason: trimmed } : {}),
        });
        setRejecting(false);
        setReason("");
      }
      onDecided?.(decision);
    } catch (cause) {
      setRejecting(false);
      setRefusal({
        message: errorMessage(
          cause,
          decision === "accepted" ? t("acceptFailed") : t("rejectFailed"),
        ),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <ActionRefusal refusal={refusal} />
      <div className="flex flex-wrap gap-2">
        {status === "submitted" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void decide("accepted")}
          >
            {t("accept")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={busy !== null}
          onClick={() => {
            setRefusal(null);
            setRejecting(true);
          }}
        >
          {t("reject")}
        </Button>
      </div>
      <Dialog
        open={rejecting}
        onOpenChange={(open) => {
          if (busy === null) setRejecting(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("rejectDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{t("rejectDialog.reason")}</Label>
            <Textarea
              id={reasonId}
              rows={3}
              maxLength={MAX_REJECTION_REASON_LENGTH}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setRejecting(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void decide("rejected")}
            >
              {busy === "rejected"
                ? t("rejectDialog.rejecting")
                : t("rejectDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
