"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Archive, CheckCircle, Clock, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { AccessionCatalogIdentifier } from "./accession-catalog-identifier";
import { AccessionDetailHeroBanner } from "./accession-detail-hero-banner";
import { AccessionDetailMainContent } from "./accession-detail-main-content";
import type { WorkflowStepInfo } from "./accession-detail-types";
import { formatWorkflowStepDetails } from "./accession-detail-ui";
import type { AccessionDetailViewProps } from "./accession-detail-view-props";
export function AccessionDetailPageClient() {
  const tRoot = useI18n();
  const params = useParams();
  const { refresh } = useRouter();
  const accessionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const locale = useCurrentLocale();
  const tCommon = useScopedI18n("common");
  const submitForApproval = useMutation(api.accessions.submitForApproval);
  const verifySource = useMutation(api.accessions.verifySource);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isVerifyingSource, setIsVerifyingSource] = useState(false);
  const [draftActionError, setDraftActionError] = useState<string | null>(null);

  const accession = useQuery(
    api.accessions.get,
    accessionId ? { accessionId: accessionId as Id<"accessions"> } : "skip",
  );
  const workflowSteps = useQuery(
    api.accessions.getWorkflowSteps,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("accessions.selectOrganizationDescription")}
        </p>
      </div>
    );
  }

  if (accession === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (accession === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tRoot("accessions.accessionNotFound")}
        </p>
      </div>
    );
  }

  const isDraft =
    accession.status === "pending" && accession.workflowStep === 0;
  const displayStatus = isDraft ? "draft" : accession.status;
  const configuredWorkflowSteps =
    workflowSteps?.steps.filter(
      (step: WorkflowStepInfo) => step.stepNumber > 0,
    ) ?? [];
  const currentWorkflowStep = configuredWorkflowSteps.find(
    (step: WorkflowStepInfo) => step.stepNumber === accession.workflowStep,
  );
  const requiresSourceVerification =
    accession.status === "pending" &&
    (workflowSteps?.requireSourceVerification ?? false);
  // An authorized exception satisfies the requirement; it is shown as such.
  const isSourceVerified =
    (accession.sourceVerified ?? false) ||
    accession.sourceVerificationException !== undefined;
  const isObjectDraft = Boolean(accession.draftObjectData);
  const canEditObjectDraft = accession.status === "pending" && isObjectDraft;
  const draftEditHref = isObjectDraft
    ? `/accessions/${accessionId}/edit-object`
    : `/accessions/${accessionId}/edit`;
  const accessionTitle =
    accession.draftObjectData?.title ||
    accession.source ||
    accession.accessionNumber;
  const accessionSubtitle = accession.draftObjectData
    ? accession.draftObjectData.creator ||
      tRoot("untranslatedRecords.accessions.detail.draftObjectAwaitingReview")
    : accession.notes ||
      tRoot("untranslatedRecords.accessions.detail.reviewSummary");
  const workflowSummary = currentWorkflowStep
    ? formatWorkflowStepDetails(currentWorkflowStep, tRoot)
    : tRoot("untranslatedRecords.accessions.detail.noActiveWorkflowStep");
  const _reviewStateLabel = isDraft
    ? tRoot("untranslatedRecords.accessions.status.draftMustSubmit")
    : accession.status === "pending"
      ? tRoot("untranslatedRecords.accessions.status.pendingReview")
      : accession.status === "approved"
        ? tRoot("untranslatedRecords.accessions.status.approved")
        : accession.status === "rejected"
          ? tRoot("untranslatedRecords.accessions.status.rejected")
          : tRoot("untranslatedRecords.accessions.status.unavailable");
  const reviewStateTone: "success" | "warning" | "default" =
    displayStatus === "approved"
      ? "success"
      : displayStatus === "pending"
        ? "warning"
        : "default";
  const _sourceVerificationState = requiresSourceVerification
    ? isSourceVerified
      ? tRoot("untranslatedRecords.accessions.source.verifiedShort")
      : tRoot("untranslatedRecords.accessions.status.sourceRequired")
    : tRoot("untranslatedRecords.accessions.status.notRequired");
  const heroReviewStateLabel = isDraft
    ? tRoot("untranslatedRecords.objects.status.draft")
    : accession.status === "pending"
      ? tRoot("loans.filters.pending")
      : accession.status === "approved"
        ? "Approved"
        : accession.status === "rejected"
          ? "Rejected"
          : tRoot("untranslatedRecords.accessions.detail.unknown");
  const heroSourceVerificationState = requiresSourceVerification
    ? accession.sourceVerificationException && !accession.sourceVerified
      ? tRoot("accessions.approval.sourceExceptionRecorded")
      : isSourceVerified
        ? tRoot("untranslatedRecords.accessions.source.verifiedShort")
        : tRoot("untranslatedRecords.accessions.status.sourceRequired")
    : tRoot("untranslatedRecords.accessions.status.notNeeded");
  const reviewRailTitle =
    currentWorkflowStep?.name ||
    tRoot("untranslatedRecords.accessions.detail.reviewCheckpoint");
  const reviewRailDescription =
    requiresSourceVerification && !isSourceVerified
      ? tRoot("untranslatedRecords.accessions.detail.sourceOnlyBlocker")
      : workflowSummary;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return <Archive className="size-5 text-zinc-400" />;
      case "pending":
        return <Clock className="size-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="size-5 text-green-500" />;
      case "rejected":
        return <XCircle className="size-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-zinc-500/10 text-zinc-300";
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "approved":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "rejected":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleSubmitDraft = async () => {
    setIsSubmittingDraft(true);
    setDraftActionError(null);
    try {
      await submitForApproval({
        accessionId: accessionId as Id<"accessions">,
      });
      refresh();
    } catch (err) {
      setDraftActionError(
        err instanceof Error
          ? err.message
          : tRoot("untranslatedRecords.accessions.errors.submitDraft"),
      );
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const handleVerifySource = async () => {
    setIsVerifyingSource(true);
    setDraftActionError(null);
    try {
      await verifySource({
        accessionId: accessionId as Id<"accessions">,
      });
      refresh();
    } catch (err) {
      setDraftActionError(
        err instanceof Error
          ? err.message
          : tRoot("untranslatedRecords.accessions.errors.verifySource"),
      );
    } finally {
      setIsVerifyingSource(false);
    }
  };

  const detailProps: AccessionDetailViewProps = {
    accession,
    locale,
    accessionId,
    isDraft,
    displayStatus,
    configuredWorkflowSteps,
    currentWorkflowStep,
    requiresSourceVerification,
    isSourceVerified,
    isObjectDraft,
    canEditObjectDraft,
    draftEditHref,
    accessionTitle,
    accessionSubtitle,
    workflowSummary,
    reviewStateTone,
    heroReviewStateLabel,
    heroSourceVerificationState,
    reviewRailTitle,
    reviewRailDescription,
    draftActionError,
    isSubmittingDraft,
    isVerifyingSource,
    getStatusIcon,
    getStatusColor,
    handleSubmitDraft,
    handleVerifySource,
  };

  return (
    <main className="z-10 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background">
      <AccessionDetailHeroBanner {...detailProps} />
      <div className="flex-1 overflow-y-auto">
        {accession.status === "pending" && !accession.collectionId ? (
          <Suspense fallback={<p>Loading catalog numbering…</p>}>
            <AccessionCatalogIdentifier
              accessionId={accession._id}
              organizationId={accession.organizationId}
              accessionNumber={accession.accessionNumber}
              catalogIdentifier={accession.catalogIdentifier}
            />
          </Suspense>
        ) : null}
        <AccessionDetailMainContent {...detailProps} />
      </div>
    </main>
  );
}
