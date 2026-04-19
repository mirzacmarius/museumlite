"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

interface ApprovalWorkflowProps {
  accessionId: string;
  compact?: boolean;
}

type WorkflowStepInfo = {
  stepNumber: number;
  name: string;
};

export function ApprovalWorkflow({
  accessionId,
  compact = false,
}: ApprovalWorkflowProps) {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("accessions");
  const tCommon = useScopedI18n("common");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );
  const workflowSteps = useQuery(
    api.accessions.getWorkflowSteps,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const approveAccession = useMutation(api.accessions.approve);
  const rejectAccession = useMutation(api.accessions.reject);

  if (
    !accession ||
    accession.status !== "pending" ||
    !accession.canCurrentUserApprove
  ) {
    return null;
  }

  const currentStep =
    workflowSteps?.steps.find(
      (step: WorkflowStepInfo) => step.stepNumber === accession.workflowStep,
    ) ?? null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await approveAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
      });
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.failedToApprove"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await rejectAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
      });
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.failedToReject"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {compact ? null : (
        <div className="space-y-1">
          <h3 className="text-lg font-medium">{t("approval.title")}</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Record a short decision note if the next reviewer or future audit
            trail would benefit from extra context.
          </p>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {currentStep && !compact ? (
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Current step
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {currentStep.name}
            </p>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="comment">{t("approval.commentLabel")}</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("approval.commentPlaceholder")}
            rows={3}
          />
          <p
            className={
              compact
                ? "text-[11px] text-muted-foreground"
                : "text-xs text-muted-foreground"
            }
          >
            Optional. This note is stored with the approval or rejection event.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PermissionGate permission="collections.approve_accession">
            <Button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="bg-green-600 transition-transform duration-200 hover:bg-green-700 active:translate-y-px"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {currentStep
                ? `Approve ${currentStep.name}`
                : accession.workflowStep
                  ? t("approval.approveStep", { step: accession.workflowStep })
                  : t("approval.approve")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isSubmitting}
                  variant="destructive"
                  className="transition-transform duration-200 active:translate-y-px"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("approval.reject")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("approval.rejectDialogTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("approval.rejectDialogDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReject}>
                    {t("approval.rejectAccession")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}
