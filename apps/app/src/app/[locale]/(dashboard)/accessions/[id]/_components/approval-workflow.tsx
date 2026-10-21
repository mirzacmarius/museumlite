"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { accessionReviewErrorFromError } from "@v1/backend/convex/utils/accessionReview";
import { workflowApprovalErrorFromError } from "@v1/backend/convex/utils/workflowApprovalErrors";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useAccessionReviewMessage } from "@/hooks/use-accession-review-message";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useI18n, useScopedI18n } from "@/locales/client";
import { useObjectDraftErrorMessage } from "../../../objects/_components/object-type-details/use-object-draft-error-message";
import { RejectIntakeDialog } from "./reject-intake-dialog";

interface ApprovalWorkflowProps {
  accessionId: string;
  compact?: boolean;
}

type WorkflowStepInfo = {
  stepNumber: number;
  name: string;
};

interface ApprovalErrorMessage {
  title: string;
  description: string;
}

/** What staff can do about a refused approval; server error text is never shown. */
function getApprovalErrorMessage(
  err: unknown,
  t: ReturnType<typeof useScopedI18n>,
  capabilityMessage: (error: unknown) => string | null,
): ApprovalErrorMessage {
  if (
    accessionReviewErrorFromError(err)?.code === "SOURCE_VERIFICATION_REQUIRED"
  ) {
    return {
      title: t("approval.errors.sourceVerificationRequiredTitle"),
      description: t("approval.errors.sourceVerificationRequiredDescription"),
    };
  }
  switch (workflowApprovalErrorFromError(err)?.code) {
    case "APPROVAL_NOT_PERMITTED":
      return {
        title: t("approval.errors.permissionDeniedTitle"),
        description: t("approval.errors.permissionDeniedDescription"),
      };
    case "ALREADY_APPROVED":
      return {
        title: t("approval.errors.alreadyApprovedTitle"),
        description: t("approval.errors.alreadyApprovedDescription"),
      };
    case "WORKFLOW_NOT_CONFIGURED":
      return {
        title: t("approval.errors.workflowConfigurationTitle"),
        description: t("approval.errors.workflowConfigurationDescription"),
      };
    // Approving an accession never starts a Removal, so neither can refuse.
    case "ALREADY_PENDING":
    case "OBJECT_IN_TRANSFER":
    case undefined:
      return {
        title: t("approval.errors.defaultTitle"),
        description:
          capabilityMessage(err) ?? t("approval.errors.defaultDescription"),
      };
  }
}

export function ApprovalWorkflow({
  accessionId,
  compact = false,
}: ApprovalWorkflowProps) {
  const tRoot = useI18n();
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("accessions");
  const reviewMessage = useAccessionReviewMessage();
  const [comment, setComment] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApprovalErrorMessage | null>(null);
  const describeDraftError = useObjectDraftErrorMessage();
  const capabilityMessage = useCapabilityErrorMessage();

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );
  const workflowSteps = useQuery(
    api.accessions.getWorkflowSteps,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const approveAccession = useMutation(api.accessions.approve);

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

  const sourceVerificationMissing =
    (workflowSteps?.requireSourceVerification ?? false) &&
    !accession.sourceVerified &&
    !accession.sourceVerificationException;

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await approveAccession({
        accessionId: accessionId as Id<"accessions">,
        comment: comment || undefined,
        sourceVerificationExceptionReason: sourceVerificationMissing
          ? exceptionReason.trim() || undefined
          : undefined,
      });
      setComment("");
      setExceptionReason("");
    } catch (err) {
      const draftError = describeDraftError(err);
      const reviewCode = accessionReviewErrorFromError(err)?.code;
      setError(
        draftError
          ? {
              title: t("approval.errors.defaultTitle"),
              description: draftError,
            }
          : reviewCode && reviewCode !== "SOURCE_VERIFICATION_REQUIRED"
            ? {
                title: t("approval.errors.defaultTitle"),
                description: reviewMessage(err),
              }
            : getApprovalErrorMessage(err, t, capabilityMessage),
      );
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
            {tRoot("untranslatedRecords.accessions.approval.noteGuidance")}
          </p>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{error.title}</p>
          <p className="mt-1 leading-6 text-destructive/90">
            {error.description}
          </p>
        </div>
      )}
      <div className={compact ? "space-y-3" : "space-y-4"}>
        {currentStep && !compact ? (
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {tRoot("untranslatedRecords.accessions.detail.currentStep")}
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
            {tRoot("untranslatedRecords.accessions.approval.optionalNoteHint")}
          </p>
        </div>
        {sourceVerificationMissing ? (
          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <Label htmlFor="source-exception-reason">
              {t("approval.sourceExceptionLabel")}
            </Label>
            <Textarea
              id="source-exception-reason"
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              {t("approval.sourceExceptionHint")}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="bg-green-600 transition-transform duration-200 hover:bg-green-700 active:translate-y-px"
          >
            <CheckCircle className="mr-2 size-4" />
            {currentStep
              ? tRoot(
                  "untranslatedRecords.accessions.approval.approveStepNamed",
                  { step: currentStep.name },
                )
              : accession.workflowStep
                ? t("approval.approveStep", { step: accession.workflowStep })
                : t("approval.approve")}
          </Button>
          <RejectIntakeDialog
            accessionId={accessionId as Id<"accessions">}
            disabled={isSubmitting}
            initialReason={comment}
            onDecided={() => setComment("")}
          />
        </div>
      </div>
    </div>
  );
}
